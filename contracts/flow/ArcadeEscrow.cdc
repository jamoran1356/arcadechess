access(all) contract ArcadeEscrow {

    // Events
    access(all) event MatchCreated(matchId: String, host: Address, stakeAmount: UFix64)
    access(all) event MatchJoined(matchId: String, guest: Address, stakeAmount: UFix64)
    access(all) event MatchSettled(matchId: String, winner: Address, prizeAmount: UFix64)
    access(all) event MatchCancelled(matchId: String)

    // Match escrow resource
    access(all) resource Match {
        access(all) let id: String
        access(all) var host: Address
        access(all) var guest: Address?
        access(all) var stakeAmount: UFix64
        access(all) var totalPool: UFix64
        access(all) var status: UInt8
        access(all) var settledAt: UFix64
        access(all) var winner: Address?

        init(
            id: String,
            host: Address,
            stakeAmount: UFix64
        ) {
            self.id = id
            self.host = host
            self.guest = nil
            self.stakeAmount = stakeAmount
            self.totalPool = stakeAmount
            self.status = 0
            self.settledAt = 0.0
            self.winner = nil
        }

        access(all) fun setGuest(_ guest: Address, _ stakeAmount: UFix64) {
            pre {
                self.guest == nil: "Guest already set"
                self.status == 0: "Match not open"
            }
            self.guest = guest
            self.totalPool = self.totalPool + stakeAmount
            self.status = 1
        }

        access(all) fun settle(winner: Address) {
            pre {
                self.status == 1: "Match not in progress"
            }
            self.status = 2
            self.winner = winner
            self.settledAt = getCurrentBlock().timestamp
        }

        access(all) fun cancel() {
            self.status = 3
        }
    }

    // Global storage
    access(self) let matches: @{String: Match}
    access(self) var nextMatchId: UInt64
    access(self) let adminAddress: Address

    init() {
        self.matches <- {}
        self.nextMatchId = 1
        self.adminAddress = self.account.address
    }

    // Create a new match
    access(all) fun createMatch(
        host: Address,
        stakeAmount: UFix64
    ): String {
        let matchId = self.nextMatchId.toString()
        self.nextMatchId = self.nextMatchId + 1

        let match <- create Match(
            id: matchId,
            host: host,
            stakeAmount: stakeAmount
        )

        emit MatchCreated(matchId: matchId, host: host, stakeAmount: stakeAmount)

        self.matches[matchId] <-! match
        return matchId
    }

    // Join a match
    access(all) fun joinMatch(
        matchId: String,
        guest: Address,
        stakeAmount: UFix64
    ) {
        pre {
            self.matches.containsKey(matchId): "Match not found"
        }

        let match <- self.matches.remove(key: matchId)!!
        match.setGuest(guest, stakeAmount)

        emit MatchJoined(matchId: matchId, guest: guest, stakeAmount: stakeAmount)

        self.matches[matchId] <-! match
    }

    // Settle a match
    access(all) fun settleMatch(
        matchId: String,
        winner: Address
    ) {
        pre {
            self.matches.containsKey(matchId): "Match not found"
        }

        let match <- self.matches.remove(key: matchId)!!
        match.settle(winner: winner)

        emit MatchSettled(
            matchId: matchId,
            winner: winner,
            prizeAmount: match.totalPool
        )

        self.matches[matchId] <-! match
    }

    // Cancel a match
    access(all) fun cancelMatch(matchId: String) {
        pre {
            self.matches.containsKey(matchId): "Match not found"
        }

        let match <- self.matches.remove(key: matchId)!!
        match.cancel()

        emit MatchCancelled(matchId: matchId)

        self.matches[matchId] <-! match
    }

    // Get match details (summary only)
    access(all) fun getMatch(matchId: String): {String: AnyStruct}? {
        if !self.matches.containsKey(matchId) {
            return nil
        }
        return { "matchId": matchId }
    }
}
