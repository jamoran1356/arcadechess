module playchess::arcade_escrow {
    use std::signer;
    use std::vector;
    use std::string::String;

    /// Status codes for matches
    const STATUS_OPEN: u8 = 0;
    const STATUS_IN_PROGRESS: u8 = 1;
    const STATUS_SETTLED: u8 = 2;
    const STATUS_CANCELLED: u8 = 3;

    const ERR_MATCH_NOT_FOUND: u64 = 1;
    const ERR_MATCH_NOT_OPEN: u64 = 2;
    const ERR_GUEST_ALREADY_SET: u64 = 3;
    const ERR_INVALID_STAKE: u64 = 4;
    const ERR_NOT_IN_PROGRESS: u64 = 5;
    const ERR_NOT_ADMIN: u64 = 6;

    /// Events
    struct MatchCreatedEvent has drop {
        match_id: u64,
        host: address,
        stake_amount: u128,
        entry_fee: u128,
    }

    struct MatchJoinedEvent has drop {
        match_id: u64,
        guest: address,
        stake_amount: u128,
    }

    struct MatchSettledEvent has drop {
        match_id: u64,
        winner: address,
        prize_amount: u128,
    }

    struct MatchCancelledEvent has drop {
        match_id: u64,
    }

    /// Match escrow resource
    struct MatchEscrow has store {
        host: address,
        guest: address,
        stake_amount: u128,
        entry_fee: u128,
        total_pool: u128,
        status: u8,
        settled_at: u64,
        winner: address,
        match_id: u64,
    }

    /// Global storage for matches
    struct MatchStorage has key {
        owner: address,
        matches: vector<MatchEscrow>,
        next_match_id: u64,
    }

    /// Initialize match storage (called once on deployment)
    public entry fun init_module(admin: &signer) {
        let storage = MatchStorage {
            owner: signer::address_of(admin),
            matches: vector::empty(),
            next_match_id: 1,
        };
        move_to(admin, storage);
    }

    /// Create a new match with escrow
    public entry fun create_match(
        host: &signer,
        stake_amount: u128,
        entry_fee: u128,
    ) acquires MatchStorage {
        let host_addr = signer::address_of(host);
        let storage = borrow_global_mut<MatchStorage>(@playchess);

        let escrow = MatchEscrow {
            host: host_addr,
            guest: @0x0,
            stake_amount,
            entry_fee,
            total_pool: stake_amount,
            status: STATUS_OPEN,
            settled_at: 0,
            winner: @0x0,
            match_id: storage.next_match_id,
        };

        vector::push_back(&mut storage.matches, escrow);
        let match_id = storage.next_match_id;
        storage.next_match_id = match_id + 1;
    }

    /// Join an existing match
    public entry fun join_match(
        guest: &signer,
        match_index: u64,
        stake_amount: u128,
    ) acquires MatchStorage {
        let guest_addr = signer::address_of(guest);
        let storage = borrow_global_mut<MatchStorage>(@playchess);

        assert!(match_index < vector::length(&storage.matches), ERR_MATCH_NOT_FOUND);

        let escrow = vector::borrow_mut(&mut storage.matches, match_index);
        assert!(escrow.status == STATUS_OPEN, ERR_MATCH_NOT_OPEN);
        assert!(escrow.guest == @0x0, ERR_GUEST_ALREADY_SET);
        assert!(stake_amount == escrow.stake_amount, ERR_INVALID_STAKE);

        escrow.guest = guest_addr;
        escrow.total_pool = escrow.total_pool + stake_amount;
        escrow.status = STATUS_IN_PROGRESS;
    }

    /// Settle a match (award prize to winner)
    public entry fun settle_match(
        admin: &signer,
        match_index: u64,
        winner: address,
    ) acquires MatchStorage {
        let admin_addr = signer::address_of(admin);
        let storage = borrow_global_mut<MatchStorage>(@playchess);

        assert!(admin_addr == storage.owner, ERR_NOT_ADMIN);
        assert!(match_index < vector::length(&storage.matches), ERR_MATCH_NOT_FOUND);

        let escrow = vector::borrow_mut(&mut storage.matches, match_index);
        assert!(escrow.status == STATUS_IN_PROGRESS, ERR_NOT_IN_PROGRESS);

        escrow.winner = winner;
        escrow.status = STATUS_SETTLED;
        escrow.settled_at = current_timestamp();
    }

    /// Cancel a match
    public entry fun cancel_match(
        admin: &signer,
        match_index: u64,
    ) acquires MatchStorage {
        let admin_addr = signer::address_of(admin);
        let storage = borrow_global_mut<MatchStorage>(@playchess);

        assert!(admin_addr == storage.owner, ERR_NOT_ADMIN);
        assert!(match_index < vector::length(&storage.matches), ERR_MATCH_NOT_FOUND);

        let escrow = vector::borrow_mut(&mut storage.matches, match_index);
        escrow.status = STATUS_CANCELLED;
    }

    /// Get match details
    public fun get_match(storage_addr: address, match_index: u64): (address, address, u128, u128, u8) acquires MatchStorage {
        let storage = borrow_global<MatchStorage>(storage_addr);
        assert!(match_index < vector::length(&storage.matches), ERR_MATCH_NOT_FOUND);

        let escrow = vector::borrow(&storage.matches, match_index);
        (escrow.host, escrow.guest, escrow.total_pool, escrow.stake_amount, escrow.status)
    }

    /// Get total active matches
    public fun get_match_count(storage_addr: address): u64 acquires MatchStorage {
        let storage = borrow_global<MatchStorage>(storage_addr);
        vector::length(&storage.matches)
    }

    fun current_timestamp(): u64 {
        0 // Placeholder - Initia proporciona esta función en el runtime
    }
}
