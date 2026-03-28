access(all) contract ArcadeEscrow {
    access(all) event MatchCreated(matchId: String, host: Address, amount: UFix64)
    access(all) event MatchJoined(matchId: String, guest: Address)
    access(all) event MatchSettled(matchId: String, winner: Address)

    access(all) resource Match {
        access(all) let id: String
        access(all) var host: Address
        access(all) var guest: Address?
        access(all) var amount: UFix64
        access(all) var winner: Address?

        init(id: String, host: Address, amount: UFix64) {
            self.id = id
            self.host = host
            self.amount = amount
            self.guest = nil
            self.winner = nil
        }
    }

    access(self) var matches: @{String: Match}

    init() {
        self.matches <- {}
    }
}
