import "FlowToken"
import "FungibleToken"

access(all) contract ArcadeEscrowV2 {

    // ─── Events ──────────────────────────────────────────────────────────────
    access(all) event MatchCreated(matchIndex: UInt64, host: Address, stakePerPlayer: UFix64, entryFee: UFix64)
    access(all) event FundsDeposited(matchIndex: UInt64, player: Address, amount: UFix64)
    access(all) event WinnerPaid(matchIndex: UInt64, winner: Address, prizeAmount: UFix64, timestamp: UFix64)
    access(all) event FundsRefunded(matchIndex: UInt64, player: Address, amount: UFix64)
    access(all) event MatchCancelled(matchIndex: UInt64)
    access(all) event DrawSettled(matchIndex: UInt64)
    access(all) event BetPlaced(betId: UInt64, matchId: String, bettor: Address, predictedWinner: Address, amount: UFix64)
    access(all) event BetSettled(betId: UInt64, matchId: String, winner: Address, payoutAmount: UFix64, won: Bool)

    // ─── Status codes (mirrors Initia/Solana) ────────────────────────────────
    access(all) let STATUS_OPEN: UInt8
    access(all) let STATUS_FUNDED: UInt8
    access(all) let STATUS_SETTLED: UInt8
    access(all) let STATUS_CANCELLED: UInt8
    access(all) let STATUS_DRAW: UInt8

    // ─── Match struct ────────────────────────────────────────────────────────
    access(all) struct MatchEscrow {
        access(all) let matchIndex: UInt64
        access(all) var host: Address
        access(all) var guest: Address?
        access(all) var stakePerPlayer: UFix64
        access(all) var entryFee: UFix64
        access(all) var hostDeposited: UFix64
        access(all) var guestDeposited: UFix64
        access(all) var status: UInt8
        access(all) var settledAt: UFix64
        access(all) var winner: Address?

        init(matchIndex: UInt64, host: Address, stakePerPlayer: UFix64, entryFee: UFix64) {
            self.matchIndex = matchIndex
            self.host = host
            self.guest = nil
            self.stakePerPlayer = stakePerPlayer
            self.entryFee = entryFee
            self.hostDeposited = 0.0
            self.guestDeposited = 0.0
            self.status = ArcadeEscrowV2.STATUS_OPEN
            self.settledAt = 0.0
            self.winner = nil
        }

        access(contract) fun deposit(player: Address, amount: UFix64) {
            if player == self.host {
                self.hostDeposited = self.hostDeposited + amount
            } else {
                if self.guest == nil {
                    self.guest = player
                }
                assert(player == self.guest!, message: "Invalid player")
                self.guestDeposited = self.guestDeposited + amount
            }
            if self.hostDeposited > 0.0 && self.guestDeposited > 0.0 {
                self.status = ArcadeEscrowV2.STATUS_FUNDED
            }
        }

        access(contract) fun settle(winner: Address) {
            self.status = ArcadeEscrowV2.STATUS_SETTLED
            self.winner = winner
            self.settledAt = getCurrentBlock().timestamp
        }

        access(contract) fun settleAsDraw() {
            self.status = ArcadeEscrowV2.STATUS_DRAW
            self.settledAt = getCurrentBlock().timestamp
        }

        access(contract) fun cancel() {
            self.status = ArcadeEscrowV2.STATUS_CANCELLED
        }
    }

    // ─── State ──────────────────────────────────────────────────────────────
    access(self) let matches: {UInt64: MatchEscrow}
    access(all) var matchCount: UInt64
    access(self) var nextBetId: UInt64

    // Vault that custodies all FLOW tokens
    access(self) let vault: @{FungibleToken.Vault}

    // Admin resource stored in deployer account
    access(all) resource Admin {
        access(all) fun createMatch(host: Address, stakePerPlayer: UFix64, entryFee: UFix64): UInt64 {
            let matchIndex = ArcadeEscrowV2.matchCount
            ArcadeEscrowV2.matchCount = ArcadeEscrowV2.matchCount + 1

            let escrow = MatchEscrow(
                matchIndex: matchIndex,
                host: host,
                stakePerPlayer: stakePerPlayer,
                entryFee: entryFee
            )
            ArcadeEscrowV2.matches[matchIndex] = escrow

            emit MatchCreated(matchIndex: matchIndex, host: host, stakePerPlayer: stakePerPlayer, entryFee: entryFee)
            return matchIndex
        }

        access(all) fun depositFunds(matchIndex: UInt64, player: Address, payment: @{FungibleToken.Vault}) {
            pre {
                ArcadeEscrowV2.matches.containsKey(matchIndex): "Match not found"
            }
            let amount = payment.balance
            ArcadeEscrowV2.vault.deposit(from: <-payment)

            var escrow = ArcadeEscrowV2.matches.remove(key: matchIndex)!
            escrow.deposit(player: player, amount: amount)
            ArcadeEscrowV2.matches[matchIndex] = escrow

            emit FundsDeposited(matchIndex: matchIndex, player: player, amount: amount)
        }

        access(all) fun settleToWinner(matchIndex: UInt64, winner: Address, prizeAmount: UFix64) {
            pre {
                ArcadeEscrowV2.matches.containsKey(matchIndex): "Match not found"
            }
            var escrow = ArcadeEscrowV2.matches.remove(key: matchIndex)!
            assert(escrow.status == ArcadeEscrowV2.STATUS_FUNDED, message: "Match not funded")
            assert(winner == escrow.host || winner == escrow.guest, message: "Invalid winner")
            let pool = escrow.hostDeposited + escrow.guestDeposited
            assert(prizeAmount <= pool, message: "Prize exceeds pool")

            // Transfer prize from vault to winner
            let prize <- ArcadeEscrowV2.vault.withdraw(amount: prizeAmount)
            let receiverCap = getAccount(winner).capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
            let receiver = receiverCap.borrow() ?? panic("Winner has no FLOW receiver")
            receiver.deposit(from: <-prize)

            escrow.settle(winner: winner)
            ArcadeEscrowV2.matches[matchIndex] = escrow

            emit WinnerPaid(matchIndex: matchIndex, winner: winner, prizeAmount: prizeAmount, timestamp: getCurrentBlock().timestamp)
        }

        access(all) fun settleDraw(matchIndex: UInt64) {
            pre {
                ArcadeEscrowV2.matches.containsKey(matchIndex): "Match not found"
            }
            var escrow = ArcadeEscrowV2.matches.remove(key: matchIndex)!
            assert(escrow.status == ArcadeEscrowV2.STATUS_FUNDED, message: "Match not funded")

            // Refund host
            if escrow.hostDeposited > 0.0 {
                let hostRefund <- ArcadeEscrowV2.vault.withdraw(amount: escrow.hostDeposited)
                let hostCap = getAccount(escrow.host).capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
                let hostReceiver = hostCap.borrow() ?? panic("Host has no FLOW receiver")
                hostReceiver.deposit(from: <-hostRefund)
                emit FundsRefunded(matchIndex: matchIndex, player: escrow.host, amount: escrow.hostDeposited)
            }

            // Refund guest
            if escrow.guestDeposited > 0.0 {
                let guestRefund <- ArcadeEscrowV2.vault.withdraw(amount: escrow.guestDeposited)
                let guestAddr = escrow.guest!
                let guestCap = getAccount(guestAddr).capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
                let guestReceiver = guestCap.borrow() ?? panic("Guest has no FLOW receiver")
                guestReceiver.deposit(from: <-guestRefund)
                emit FundsRefunded(matchIndex: matchIndex, player: guestAddr, amount: escrow.guestDeposited)
            }

            escrow.settleAsDraw()
            ArcadeEscrowV2.matches[matchIndex] = escrow
            emit DrawSettled(matchIndex: matchIndex)
        }

        access(all) fun refundMatch(matchIndex: UInt64) {
            pre {
                ArcadeEscrowV2.matches.containsKey(matchIndex): "Match not found"
            }
            var escrow = ArcadeEscrowV2.matches.remove(key: matchIndex)!
            assert(
                escrow.status == ArcadeEscrowV2.STATUS_OPEN || escrow.status == ArcadeEscrowV2.STATUS_FUNDED,
                message: "Match not refundable"
            )

            if escrow.hostDeposited > 0.0 {
                let hostRefund <- ArcadeEscrowV2.vault.withdraw(amount: escrow.hostDeposited)
                let hostCap = getAccount(escrow.host).capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
                let hostReceiver = hostCap.borrow() ?? panic("Host has no FLOW receiver")
                hostReceiver.deposit(from: <-hostRefund)
                emit FundsRefunded(matchIndex: matchIndex, player: escrow.host, amount: escrow.hostDeposited)
            }

            if escrow.guestDeposited > 0.0 && escrow.guest != nil {
                let guestRefund <- ArcadeEscrowV2.vault.withdraw(amount: escrow.guestDeposited)
                let guestAddr = escrow.guest!
                let guestCap = getAccount(guestAddr).capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
                let guestReceiver = guestCap.borrow() ?? panic("Guest has no FLOW receiver")
                guestReceiver.deposit(from: <-guestRefund)
                emit FundsRefunded(matchIndex: matchIndex, player: guestAddr, amount: escrow.guestDeposited)
            }

            escrow.cancel()
            ArcadeEscrowV2.matches[matchIndex] = escrow
            emit MatchCancelled(matchIndex: matchIndex)
        }
    }

    // ─── View functions ──────────────────────────────────────────────────────
    access(all) fun getMatchCount(): UInt64 {
        return self.matchCount
    }

    access(all) fun getMatch(matchIndex: UInt64): MatchEscrow? {
        return self.matches[matchIndex]
    }

    access(all) fun getVaultBalance(): UFix64 {
        return self.vault.balance
    }

    // ─── Init ────────────────────────────────────────────────────────────────
    init() {
        self.STATUS_OPEN = 0
        self.STATUS_FUNDED = 1
        self.STATUS_SETTLED = 2
        self.STATUS_CANCELLED = 3
        self.STATUS_DRAW = 4

        self.matches = {}
        self.matchCount = 0
        self.nextBetId = 1
        self.vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())

        // Store Admin resource in deployer account
        let admin <- create Admin()
        self.account.storage.save(<-admin, to: /storage/ArcadeEscrowV2Admin)
    }
}
