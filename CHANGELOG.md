# Changelog

All notable changes to PlayChess are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Beta] — 2026-04-10

### Added

- **Multi-network wallet integration** — Full client-side wallet connection for Solana and Flow, replicating all Initia functionality:
  - Solana: `@solana/wallet-adapter-react` with Phantom and Solflare adapters
  - Flow: `@onflow/fcl` lazy-loaded with testnet discovery wallet (Blocto/Lilico)
  - New hooks: `use-solana-wallet.ts` (escrow via SystemProgram.transfer + memo), `use-flow-wallet.ts` (FCL authenticate + FLOW token transfer)
  - `interwovenkit-providers.tsx` wraps app with SolanaProviders (ConnectionProvider + WalletProvider + WalletModalProvider)

- **Multi-network match creation & joining** — `create-match-form.tsx` and `join-match-form.tsx` now support escrow signing on all 3 networks with `NETWORK_TOKEN` mapping (INITIA→INIT, SOLANA→SOL, FLOW→FLOW) and dynamic token display.

- **Multi-network wallet login** — `auth-form.tsx` shows 3 wallet login options (Initia cyan, Solana amber, Flow emerald). `walletAuthAction` auto-detects network from address format.

- **Multi-network balance display** — `onchain-balance.tsx` detects connected wallet per network and auto-links real addresses to platform wallets.

- **Multi-network navbar** — 3 separate wallet connection buttons in desktop dropdown and mobile drawer with network-specific colors and truncated addresses. Logout disconnects all wallets.

- **Client-safe explorer URLs** — `getExplorerTxUrlClient()` in `explorer.ts` for Initia, Solana (devnet), and Flow (testnet).

- **FCL type declarations** — `src/types/onflow-fcl.d.ts` with types for `@onflow/fcl` and `@onflow/types`.

- **Network enablement in seed** — `prisma/seed.mjs` now upserts platformConfig with `enabledNetworks: ["INITIA", "SOLANA", "FLOW"]`.

### Changed

- `actions.ts` balance validation extended from Initia-only to all 3 networks.
- `walletAuthAction` extended to auto-detect Solana and Flow addresses.
- `.env` now includes `NEXT_PUBLIC_SOLANA_ADMIN_ADDRESS`.

### Fixed

- **TypeScript compilation clean** — Resolved all pre-existing TS7016 errors for `@onflow/fcl` by adding ambient type declarations. `npx tsc --noEmit` now exits with 0 errors.

---

## [Beta] — 2026-04-10

### Added

- **Solana real on-chain escrow** — Rewrote the Anchor contract (`contracts/solana-anchor/programs/arcade_escrow/src/lib.rs`) to custody real SOL in a PDA vault, matching the Initia escrow architecture:
  - `initialize_vault`: one-time setup for admin-controlled vault PDA
  - `create_match` + `deposit_funds`: create match and deposit SOL from admin treasury
  - `settle_to_winner`: transfer prize SOL from vault to winner
  - `settle_draw`: refund both players from vault
  - `refund_match`: cancel and return all deposits
  - `place_bet` / `settle_bet`: bet SOL custody through vault
  - All entry functions admin-gated (same custody model as Initia)
  - Sequential `match_index` tracking via vault `match_count`

- **Solana adapter rewrite** — Replaced mock adapter (`src/lib/onchain/solana.ts`) with real Solana devnet integration:
  - Uses `@solana/web3.js` + raw Anchor instruction encoding
  - Admin keypair from `SOLANA_PAYER_KEYPAIR` env var
  - PDA derivation for vault, match, and bet accounts
  - Real `queryBalance()` via `connection.getBalance()`
  - Graceful fallback to mock mode when not configured
  - Explorer links with `?cluster=devnet` suffix

- **Solana dependencies** — Added `@solana/web3.js@1`, `@coral-xyz/anchor`, `bs58` to project dependencies.

- **Flow real on-chain escrow** — Rewrote the Cadence contract (`contracts/flow/ArcadeEscrow.cdc`) with real FLOW token custody:
  - Contract now imports `FlowToken` and `FungibleToken` for real token transfers
  - `Admin` resource pattern: only deployer account can create/settle/refund matches
  - `depositFunds`: receives `@{FungibleToken.Vault}` payment, custodies in contract vault
  - `settleToWinner`: withdraws from vault and sends FLOW to winner's receiver capability
  - `settleDraw` / `refundMatch`: returns deposited FLOW to both players
  - Sequential `matchCount` tracking (same model as Initia/Solana)
  - Cadence 1.0 syntax with entitlement-based access control

- **Flow adapter rewrite** — Replaced mock adapter (`src/lib/onchain/flow.ts`) with real Flow testnet integration:
  - Uses `@onflow/fcl` for query/mutate with server-side authorization
  - ECDSA P-256 + SHA3-256 signing via `elliptic` + `sha3`
  - Cadence transaction templates for all escrow operations
  - Real `queryBalance()` via Flow REST API
  - Graceful fallback to mock mode when not configured
  - Explorer links to testnet.flowscan.io

- **Flow dependencies** — Added `@onflow/fcl`, `@onflow/types`, `elliptic`, `sha3`, `@types/elliptic` to project dependencies.

### Changed

- Updated `.env.example` with Solana devnet configuration variables (`SOLANA_PAYER_KEYPAIR`).
- Explorer URL filter now excludes `sol_mock_` hashes from generating links.

---

## [Beta] — 2026-03-31

### Added

- **Real wallet fund flow** — Wallet balances are now debited when creating, joining, or betting on a match, and credited upon winning. Replaced the auto-topup mock (`ensurePlayableWallet` with 25-token auto-fund) with actual balance validation via `getWalletOrFail`.
  - New shared module `src/lib/wallet.ts` with `getWalletOrFail`, `debitWallet`, `creditWallet`.
  - `createMatchAction`, `joinMatchAction`, `startSoloMatchAction`, `placeMatchBetAction` all validate sufficient funds and debit the wallet.
  - `settleWinner()` and `settleSpectatorBets()` now credit the winner's and winning bettors' wallet balances.

- **Stake confirmation panel** — Match page now shows stake amount, entry fee, and total cost before the join/start button so players know exactly what will be locked.

- **Blockchain explorer links** — `getExplorerTxUrl()` and `getExplorerAddressUrl()` helpers in `src/lib/onchain/service.ts` generate testnet explorer URLs for Initia, Flow, and Solana.
  - Dashboard transaction table includes an "Explorer" column with tx links (hidden for mock hashes).
  - Dashboard wallet cards link addresses to the corresponding network explorer.

- **Wallet balance in lobby** — Match creation form now shows current balances for all networks below the stake input fields.

- **Friendships (DB-persistent)** — New `Friendship` model in Prisma with `PENDING` / `ACCEPTED` states.
  - Migration `202603300003_add_friendships` creates the table with FK constraints and indexes.
  - Server actions: `addFriendAction` (search by email or wallet), `acceptFriendAction`, `removeFriendAction`.
  - `FriendInvitePanel` now loads real data from DB and renders three sections: incoming requests, accepted friends, and outgoing pending requests.

- **Wallet linking from dashboard** — Users can add or update their wallet address per blockchain network (INITIA / FLOW / SOLANA) via a form in the dashboard. Server action `linkWalletAddressAction` handles upsert.

- **Network selector in wallet connect button** — Dropdown persisted to `localStorage` lets users select their preferred network before connecting.

- **Match share & invite controls** — `MatchShareControls` component added to lobby match cards and the in-game stake sidebar. Supports copy link to clipboard, email invite via `mailto:`, and WhatsApp share.

- **Blockchain filter in lobby** — Pill buttons (ALL / INITIA / FLOW / SOLANA) filter the visible match list. Filter state driven by `searchParams.network`.

- **Clock timeout auto-win** — `checkAndResolveTimeoutVictory()` runs at the start of every `performMatchMove()`. When a player's clock hits zero the match is marked `FINISHED`, the opponent is declared winner, and `settleWinner()` is called automatically. A timeout message is shown in the client UI.

- **Solo arcade dynamic timer** — `getSoloArcadeTimeLimitMs()` in `arcade.ts` computes a time limit between 3 s and 10 s based on the Manhattan distance from the capture square to the enemy king. Applied to solo-duel `ArcadeDuel` in both `data.ts` (snapshot) and `match-engine.ts` (evaluation).

- **Deploy script** — `scripts/deploy-server.sh` automates the full server deployment sequence: start postgres → run migrate service → rebuild and restart app container.
- **Bot move endpoint for solo matches** — Added `POST /api/matches/[id]/bot-move` to execute the computer move server-side.
- **Reusable dialog system** — Added `DialogModal` component and integrated it into match resign flow and arcade-games admin actions.

### Fixed

- **Arcade modal double-open** — Duel modal now tracks only the current player's score (`myScore`) to determine resolved state, preventing the modal from jumping to "submitted" when the opponent submits first.
- **Clock stops after arcade duel** — All 6 `tx.match.update` calls in `resolveDuelWithPenalty()` and `resolveDuelByScores()` now set `turnStartedAt: new Date()`, restarting the clock after duel resolution.
- **PrivyWalletProvider polling spam** — Polling interval increased to 4s during `ARCADE_PENDING` status (from 1.5s) to reduce re-render frequency.
- **TypeScript `Square` type error** in `match-engine.ts` — `chess.remove()` requires type `Square`, not `string`. Added `isSquare()` type guard with regex `[a-h][1-8]`.
- **`displayClocks` used before declaration** in `chess-match-client.tsx` — clock timeout `useEffect` was referencing a `useState` value declared later in the file; reordered to fix.
- **Arcade loss capture consistency** — when the attacker loses an arcade duel (including penalty/no-show path), the attacker piece is now removed from the board instead of reverting state.
- **Prisma client drift during build** — added `prebuild: prisma generate` to keep generated types in sync before every Next.js build.
- **Pending duel typing mismatch** — ensured `pendingDuel.game` is always populated in match snapshot to satisfy strict TypeScript expectations.
- **Arcade replay loop** — the duel modal now preserves local state for the active duel and no longer depends on full page refreshes, preventing the minigame from restarting in a loop.
- **Multiplayer arcade start sync** — pending duel snapshot now includes `attackerEnteredAt`/`defenderEnteredAt`, and when one player enters the minigame the opponent auto-enters/auto-starts from intro without page reload.
- **Clock timeout hard-close** — match state endpoint now triggers backend timeout resolution (`syncMatchTimeoutIfNeeded`) so games close immediately at 0 without waiting for a user move.
- **Duel resolution guarantee** — participation monitor now resolves arcade duels by score when both players entered but one/both did not submit in time, defaulting missing score to 0 and always producing a winner.
- **First move visibility fix** — match client now syncs `guest` and board state from `/api/matches/[id]/state`, removing the need for manual refresh when opponent joins/moves first.
- **Quick match creation UX** — creating a match no longer asks for title or description; backend auto-generates title and default theme so users only set gameplay essentials.
- **Bet eligibility clarity** — match sidebar now lists exact reasons why betting is blocked (not spectator, no rival yet, betting phase closed, already bet, etc.).
- **Opponent resignation win modal** — when a player resigns, opponent now receives a victory dialog in match client; resign event is recorded in `moveHistory` as `[resign]` marker.
- **Post-duel freeze guard** — match client now clears stale `pendingDuel` unless status remains `ARCADE_PENDING`, and move enablement relies on `status + turn` to prevent frozen turns after duel resolution.

### Changed

- **Solo vs computer pacing** — bot move no longer executes immediately after the human move; client now waits 3 seconds then triggers `/api/matches/[id]/bot-move`.
- **Resign UX** — replaced native `window.confirm` with a full in-app confirmation dialog in match screen.
- **Admin arcade UX** — replaced all `alert/confirm` calls with in-app dialog windows for success, error, warning and delete confirmation.
- **Dashboard redesign** — rebuilt `/dashboard` with sticky left navigation, section anchors, improved visual hierarchy, and cleaner grouped content blocks.
- **Versus match sync** — added `GET /api/matches/[id]/state` and client polling in match screen so opponent moves and duel resolution propagate fluidly without manual refresh.
- **Dashboard UX simplification** — removed the internal navigation block to avoid dual navigation bars, keeping a single global navigation and concise status cards inside dashboard.

---

## [0.3.0] — 2026-03-30

### Added

- **Reconcile migration** `202603300002_reconcile_existing_db` — idempotent SQL (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) to bring existing deployed databases up to date without data loss.
- Admin seed user (`admin@playchess.gg` / `Admin123!`) inserted via `ON CONFLICT DO NOTHING`.
- `PlatformConfig` default row seeded in same migration.

### Changed

- Consolidated 4 incremental migrations into a single baseline `202603300001_init/migration.sql` for new deployments.
- `docker-compose.yml` `migrate` service uses `prisma migrate deploy` with fallback `resolve --applied` for pre-existing databases.

---

## [0.2.0] — 2026-03-30

### Added

- Multi-network blockchain support: `TransactionNetwork` enum (`INITIA`, `FLOW`, `SOLANA`) on matches, wallets, and transactions.
- `whiteClockMs`, `blackClockMs`, `turnStartedAt` columns on `Match` for per-player game clocks.
- `InterwovenKit` wallet connect integration for Initia network.
- Arcade duel system (`ArcadeDuel`, `ArcadeGame` models) with `TARGET_RUSH`, `MEMORY_GRID`, `KEY_CLASH` game types.
- Match betting (`MatchBet` model) with fee calculation and payout settlement.
- Solo match mode (`isSolo` flag) for single-player arcade practice.
- `PlatformConfig` model for fee configuration (match fee bps, bet fee bps, arcade fee).
- Admin area (`/admin`) protected by `requireAdmin()` guard.
- i18n dictionary system with locale detection.

---

## [0.1.0] — 2026-03-29

### Added

- Initial project setup with Next.js 16 App Router, TypeScript, Tailwind CSS.
- Prisma ORM with PostgreSQL — `User`, `Wallet`, `Match`, `Transaction`, `Plan` models.
- JWT authentication (`jose`) — register, login, session cookies, `requireUser()` / `requireAdmin()`.
- Chess board powered by `chess.js` with FEN-based state, move history, and legal move validation.
- Lobby page: create match with stake, join open matches.
- Dashboard: profile, hosted/joined matches, wallet balances.
- Docker Compose setup with `postgres`, `migrate`, and `app` services.
