/// PlayChess Arcade Escrow - Real Token Custody
///
/// This contract holds real INIT tokens. Funds are deposited
/// into a vault-object when creating/joining matches, and only
/// the owner (admin) can execute settlements after multi-layer
/// internal validation.
///
/// Security:
///   1. Only the owner can call mutation functions
///   2. The vault is an Object with ExtendRef - only this module
///      can generate its signer to transfer funds
///   3. Internal validation: match exists, is funded, winner is
///      a participant, prize <= pool, no re-settlement
///   4. On-chain events for full audit trail
module playchess::arcade_escrow_v2 {
    use std::signer;
    use std::vector;
    use std::string;
    use std::error;

    // Initia framework (address 0x1)
    use initia_std::coin;
    use initia_std::object::{Self, ExtendRef};
    use initia_std::block;
    use initia_std::event;

    // -- Error codes --
    const ERR_NOT_ADMIN: u64 = 1;
    const ERR_MATCH_NOT_FOUND: u64 = 2;
    const ERR_MATCH_NOT_OPEN: u64 = 3;
    const ERR_MATCH_NOT_FUNDED: u64 = 4;
    const ERR_ALREADY_SETTLED: u64 = 5;
    const ERR_INVALID_WINNER: u64 = 6;
    const ERR_PRIZE_EXCEEDS_POOL: u64 = 7;
    const ERR_DUPLICATE_DEPOSIT: u64 = 8;

    // -- Match status --
    const STATUS_OPEN: u8 = 0;       // Created, waiting for deposits
    const STATUS_FUNDED: u8 = 1;     // Both players deposited
    const STATUS_SETTLED: u8 = 2;    // Winner paid
    const STATUS_CANCELLED: u8 = 3;  // Cancelled and refunded
    const STATUS_DRAW: u8 = 4;       // Draw and refunded

    // -- Events --
    #[event]
    struct MatchCreated has drop, store {
        match_id: u64,
        host: address,
        stake_per_player: u64,
        entry_fee: u64,
    }

    #[event]
    struct FundsDeposited has drop, store {
        match_id: u64,
        player: address,
        amount: u64,
    }

    #[event]
    struct WinnerPaid has drop, store {
        match_id: u64,
        winner: address,
        prize: u64,
        timestamp: u64,
    }

    #[event]
    struct FundsRefunded has drop, store {
        match_id: u64,
        player: address,
        amount: u64,
    }

    #[event]
    struct MatchCancelled has drop, store {
        match_id: u64,
    }

    // -- Data structures --
    struct MatchEscrow has store {
        host: address,
        guest: address,
        stake_per_player: u64,
        entry_fee: u64,
        host_deposited: u64,
        guest_deposited: u64,
        status: u8,
        winner: address,
        settled_at: u64,
    }

    /// Main vault: stores match state + ExtendRef
    /// to generate the vault-object signer that holds the INIT.
    struct EscrowVault has key {
        owner: address,
        extend_ref: ExtendRef,
        vault_addr: address,
        matches: vector<MatchEscrow>,
        next_match_id: u64,
    }

    // =============================================================
    //  init_module - executed once when the module is published
    // =============================================================
    /// Creates a named object ("escrow_vault") that will be the
    /// on-chain address holding real INIT tokens.
    fun init_module(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        let constructor = object::create_named_object(admin, b"escrow_vault");
        let vault_addr = object::address_from_constructor_ref(&constructor);
        let extend_ref = object::generate_extend_ref(&constructor);

        move_to(admin, EscrowVault {
            owner: admin_addr,
            extend_ref,
            vault_addr,
            matches: vector::empty(),
            next_match_id: 1,
        });
    }

    // =============================================================
    //  create_match - Admin registers a new match
    // =============================================================
    public entry fun create_match(
        admin: &signer,
        host: address,
        stake_per_player: u64,
        entry_fee: u64,
    ) acquires EscrowVault {
        let v = borrow_global_mut<EscrowVault>(@playchess);
        assert!(
            signer::address_of(admin) == v.owner,
            error::permission_denied(ERR_NOT_ADMIN)
        );

        let id = v.next_match_id;
        v.next_match_id = id + 1;

        vector::push_back(&mut v.matches, MatchEscrow {
            host,
            guest: @0x0,
            stake_per_player,
            entry_fee,
            host_deposited: 0,
            guest_deposited: 0,
            status: STATUS_OPEN,
            winner: @0x0,
            settled_at: 0,
        });

        event::emit(MatchCreated {
            match_id: id,
            host,
            stake_per_player,
            entry_fee,
        });
    }

    // =============================================================
    //  deposit_funds - Admin deposits real INIT to the vault
    // =============================================================
    /// Transfers real INIT tokens from the admin wallet to the
    /// contract vault-object. Records which player it is for.
    public entry fun deposit_funds(
        admin: &signer,
        match_index: u64,
        player: address,
        amount: u64,
    ) acquires EscrowVault {
        let admin_addr = signer::address_of(admin);

        // Step 1: validate and read vault_addr
        let vault_addr;
        {
            let v = borrow_global<EscrowVault>(@playchess);
            assert!(
                admin_addr == v.owner,
                error::permission_denied(ERR_NOT_ADMIN)
            );
            let len = vector::length(&v.matches);
            assert!(match_index < len, error::not_found(ERR_MATCH_NOT_FOUND));
            let escrow = vector::borrow(&v.matches, match_index);
            assert!(
                escrow.status == STATUS_OPEN,
                error::invalid_state(ERR_MATCH_NOT_OPEN)
            );
            vault_addr = v.vault_addr;
        };

        // Step 2: transfer real tokens from admin -> vault
        let metadata = coin::denom_to_metadata(string::utf8(b"uinit"));
        coin::transfer(admin, vault_addr, metadata, amount);

        // Step 3: update match state
        let v = borrow_global_mut<EscrowVault>(@playchess);
        let escrow = vector::borrow_mut(&mut v.matches, match_index);

        if (player == escrow.host) {
            assert!(
                escrow.host_deposited == 0,
                error::already_exists(ERR_DUPLICATE_DEPOSIT)
            );
            escrow.host_deposited = amount;
        } else {
            assert!(
                escrow.guest == @0x0 || escrow.guest == player,
                error::already_exists(ERR_DUPLICATE_DEPOSIT)
            );
            escrow.guest = player;
            escrow.guest_deposited = amount;
        };

        // Auto-fund if both deposits arrived
        if (escrow.host_deposited > 0 && escrow.guest_deposited > 0) {
            escrow.status = STATUS_FUNDED;
        };

        event::emit(FundsDeposited {
            match_id: match_index,
            player,
            amount,
        });
    }

    // =============================================================
    //  settle_to_winner - MAIN SETTLEMENT FUNCTION
    // =============================================================
    /// Multi-layer validation then transfers INIT from vault to winner.
    ///
    /// Security layers:
    ///   1. Only the contract owner can call
    ///   2. The match must exist
    ///   3. The match must be in FUNDED state
    ///   4. The winner must be host or guest (real participant)
    ///   5. The prize cannot exceed the deposited pool
    ///   6. The match can only be settled once
    public entry fun settle_to_winner(
        admin: &signer,
        match_index: u64,
        winner: address,
        prize_amount: u64,
    ) acquires EscrowVault {
        let admin_addr = signer::address_of(admin);
        let v = borrow_global_mut<EscrowVault>(@playchess);

        // Layer 1: Only owner
        assert!(
            admin_addr == v.owner,
            error::permission_denied(ERR_NOT_ADMIN)
        );

        // Layer 2: Match exists
        let len = vector::length(&v.matches);
        assert!(match_index < len, error::not_found(ERR_MATCH_NOT_FOUND));

        // Validate match state (immutable borrow in block)
        {
            let escrow = vector::borrow(&v.matches, match_index);

            // Layer 3: Match funded
            assert!(
                escrow.status == STATUS_FUNDED,
                error::invalid_state(ERR_MATCH_NOT_FUNDED)
            );

            // Layer 4: Winner is participant
            assert!(
                winner == escrow.host || winner == escrow.guest,
                error::invalid_argument(ERR_INVALID_WINNER)
            );

            // Layer 5: Prize <= pool
            let total = escrow.host_deposited + escrow.guest_deposited;
            assert!(
                prize_amount <= total,
                error::invalid_argument(ERR_PRIZE_EXCEEDS_POOL)
            );
        };

        // Execute transfer: vault -> winner
        let metadata = coin::denom_to_metadata(string::utf8(b"uinit"));
        let vault_signer = object::generate_signer_for_extending(&v.extend_ref);
        coin::transfer(&vault_signer, winner, metadata, prize_amount);

        // Record settlement (layer 6: no re-settlement)
        let (_, timestamp) = block::get_block_info();
        let escrow = vector::borrow_mut(&mut v.matches, match_index);
        escrow.winner = winner;
        escrow.status = STATUS_SETTLED;
        escrow.settled_at = timestamp;

        event::emit(WinnerPaid {
            match_id: match_index,
            winner,
            prize: prize_amount,
            timestamp,
        });
    }

    // =============================================================
    //  refund_match - Cancel and refund deposits
    // =============================================================
    public entry fun refund_match(
        admin: &signer,
        match_index: u64,
    ) acquires EscrowVault {
        let admin_addr = signer::address_of(admin);
        let v = borrow_global_mut<EscrowVault>(@playchess);
        assert!(
            admin_addr == v.owner,
            error::permission_denied(ERR_NOT_ADMIN)
        );

        let len = vector::length(&v.matches);
        assert!(match_index < len, error::not_found(ERR_MATCH_NOT_FOUND));

        // Read data for refund
        let host;
        let guest;
        let host_dep;
        let guest_dep;
        {
            let escrow = vector::borrow(&v.matches, match_index);
            assert!(
                escrow.status == STATUS_OPEN || escrow.status == STATUS_FUNDED,
                error::invalid_state(ERR_ALREADY_SETTLED)
            );
            host = escrow.host;
            guest = escrow.guest;
            host_dep = escrow.host_deposited;
            guest_dep = escrow.guest_deposited;
        };

        // Refund from vault
        let metadata = coin::denom_to_metadata(string::utf8(b"uinit"));
        let vault_signer = object::generate_signer_for_extending(&v.extend_ref);

        if (host_dep > 0) {
            coin::transfer(&vault_signer, host, metadata, host_dep);
            event::emit(FundsRefunded {
                match_id: match_index,
                player: host,
                amount: host_dep,
            });
        };

        if (guest != @0x0 && guest_dep > 0) {
            coin::transfer(&vault_signer, guest, metadata, guest_dep);
            event::emit(FundsRefunded {
                match_id: match_index,
                player: guest,
                amount: guest_dep,
            });
        };

        // Update state
        let escrow = vector::borrow_mut(&mut v.matches, match_index);
        escrow.status = STATUS_CANCELLED;

        event::emit(MatchCancelled { match_id: match_index });
    }

    // =============================================================
    //  settle_draw - Draw: refund both players
    // =============================================================
    public entry fun settle_draw(
        admin: &signer,
        match_index: u64,
    ) acquires EscrowVault {
        let admin_addr = signer::address_of(admin);
        let v = borrow_global_mut<EscrowVault>(@playchess);
        assert!(
            admin_addr == v.owner,
            error::permission_denied(ERR_NOT_ADMIN)
        );

        let len = vector::length(&v.matches);
        assert!(match_index < len, error::not_found(ERR_MATCH_NOT_FOUND));

        let host;
        let guest;
        let host_dep;
        let guest_dep;
        {
            let escrow = vector::borrow(&v.matches, match_index);
            assert!(
                escrow.status == STATUS_FUNDED,
                error::invalid_state(ERR_MATCH_NOT_FUNDED)
            );
            host = escrow.host;
            guest = escrow.guest;
            host_dep = escrow.host_deposited;
            guest_dep = escrow.guest_deposited;
        };

        let metadata = coin::denom_to_metadata(string::utf8(b"uinit"));
        let vault_signer = object::generate_signer_for_extending(&v.extend_ref);

        if (host_dep > 0) {
            coin::transfer(&vault_signer, host, metadata, host_dep);
            event::emit(FundsRefunded {
                match_id: match_index,
                player: host,
                amount: host_dep,
            });
        };

        if (guest_dep > 0) {
            coin::transfer(&vault_signer, guest, metadata, guest_dep);
            event::emit(FundsRefunded {
                match_id: match_index,
                player: guest,
                amount: guest_dep,
            });
        };

        let (_, timestamp) = block::get_block_info();
        let escrow = vector::borrow_mut(&mut v.matches, match_index);
        escrow.status = STATUS_DRAW;
        escrow.settled_at = timestamp;
    }

    // =============================================================
    //  View functions (on-chain queries)
    // =============================================================

    #[view]
    /// Address of the vault that holds the funds.
    public fun get_vault_address(): address acquires EscrowVault {
        borrow_global<EscrowVault>(@playchess).vault_addr
    }

    #[view]
    public fun get_match_count(): u64 acquires EscrowVault {
        vector::length(&borrow_global<EscrowVault>(@playchess).matches)
    }

    #[view]
    /// Returns: (host, guest, stake, fee, host_dep, guest_dep, status, winner, settled_at)
    public fun get_match(match_index: u64): (
        address, address, u64, u64, u64, u64, u8, address, u64
    ) acquires EscrowVault {
        let v = borrow_global<EscrowVault>(@playchess);
        assert!(
            match_index < vector::length(&v.matches),
            error::not_found(ERR_MATCH_NOT_FOUND)
        );
        let e = vector::borrow(&v.matches, match_index);
        (
            e.host, e.guest,
            e.stake_per_player, e.entry_fee,
            e.host_deposited, e.guest_deposited,
            e.status, e.winner, e.settled_at
        )
    }

    #[view]
    /// Total INIT balance held in the vault.
    public fun get_vault_balance(): u64 acquires EscrowVault {
        let v = borrow_global<EscrowVault>(@playchess);
        let metadata = coin::denom_to_metadata(string::utf8(b"uinit"));
        coin::balance(v.vault_addr, metadata)
    }
}
