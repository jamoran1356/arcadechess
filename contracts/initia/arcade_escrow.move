module playchess::arcade_escrow {
    use std::string::{Self, String};
    use sui::object::{Self, UID};

    public struct MatchEscrow has key {
        id: UID,
        host: address,
        guest: address,
        stake_amount: u64,
        token_symbol: String,
        winner: address,
        status: u8,
    }

    public entry fun create_match(host: &signer, stake_amount: u64, token_symbol: String) {
        let _host_addr = signer::address_of(host);
        let _escrow = MatchEscrow {
            id: object::new(),
            host: _host_addr,
            guest: @0x0,
            stake_amount,
            token_symbol,
            winner: @0x0,
            status: 0,
        };
    }

    public entry fun join_match(_guest: &signer, _match_id: ID) {
    }

    public entry fun settle_match(_admin: &signer, _match_id: ID, _winner: address) {
    }
}
