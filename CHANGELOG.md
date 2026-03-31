# Changelog

All notable changes to PlayChess are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Beta] — 2026-03-31

### Added

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

### Fixed

- **TypeScript `Square` type error** in `match-engine.ts` — `chess.remove()` requires type `Square`, not `string`. Added `isSquare()` type guard with regex `[a-h][1-8]`.
- **`displayClocks` used before declaration** in `chess-match-client.tsx` — clock timeout `useEffect` was referencing a `useState` value declared later in the file; reordered to fix.

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
