# ♟️ Arcade Chess Arena  
### *Where strategy meets reflex. Where every capture becomes a fight.*

---

## 🚀 The Idea

**Arcade Chess Arena** reinvents one of the most iconic games ever created.

In traditional chess, a capture is automatic.

In Arcade Chess Arena, **a capture is a battle**.

When a player attempts to take a piece:
- both players are pulled into a **real-time skill duel**
- speed, precision, and execution decide the outcome
- the winner claims the square

> 🧠 Strategy chooses the move.  
> ⚡ Skill determines the result.

---

## 🧩 Why This Matters

Chess has survived centuries — but digital chess hasn’t evolved at the same pace.

Modern players want:
- interaction  
- adrenaline  
- skill expression  
- spectacle  

Arcade Chess Arena introduces:
- **real-time tension inside turn-based gameplay**
- **mechanical skill layered over pure strategy**
- **highlight-worthy moments in every match**

This is not a variation of chess.  
This is **a new competitive genre.**

---

## Initia Hackathon Submission

- **Project Name**: Arcade Chess Arena

### Project Overview

Arcade Chess Arena transforms a chess match into a hybrid competitive experience where every capture is resolved through a real-time arcade duel. The product is designed for competitive players, tournament creators, and Web3 communities looking for higher-intensity matches, verifiable outcomes, and stronger retention. Its core value is combining classic strategy with mechanical execution under pressure.

### Implementation Detail

- **The Custom Implementation**: We implemented a capture-resolution layer based on synchronized mini-games between attacker and defender, with result validation and backend match-state updates.
- **The Native Feature**: We integrated InterwovenKit into the app using `InterwovenKitProvider`, wallet connection in the top bar, and `enableAutoSign={true}` to enable auto-sign flow on the default chain. This reduces friction in repetitive operations within the competitive flow.


## 🎮 Core Gameplay Loop

1. Players join or create a match  
2. Game follows standard chess rules  
3. A capture is attempted  
4. ⚔️ Duel is triggered  
5. Both players enter a **mini-game simultaneously**  
6. Fastest / most precise player wins  
7. Board state updates  
8. Game continues  

---

## ⚔️ The Duel System

Every capture transforms into a **micro-competition**.

### Current Mini-Games (Prototype)
- Reaction speed tests  
- Timing challenges  
- Target precision  

### Future Expansions
- Pattern recognition  
- Memory-based duels  
- Skill-based aim mechanics  
- Adaptive difficulty systems  

Designed to be:
- fast (seconds, not minutes)  
- fair  
- repeatable  
- competitive  

---

## ⛓️ Blockchain as Infrastructure

This project doesn’t “add blockchain.”  
It **uses blockchain where it actually matters**:

### Powered by:
- **Initia (primary)**
- **Flow**
- **Solana**

### Enables:
- 🏆 Onchain tournaments  
- 💰 Entry-fee matches  
- 📜 Verifiable match results  
- 📊 Player history & progression  
- 🌐 Decentralized competitive ecosystems  

Players can:
- create matches  
- set stakes  
- host tournaments  
- earn rewards  
- build competitive communities  

---

## 🧠 Core Innovation

> **Every capture becomes a moment of real competition.**

This single mechanic:
- preserves chess fundamentals  
- adds execution pressure  
- rewards reflex + skill  
- creates natural spectator highlights  

It turns passive gameplay into **active combat**.

---

## 🏗️ Architecture (MVP)

Built for speed, scalability, and iteration.

### Frontend
- Next.js (App Router)  
- TypeScript  
- TailwindCSS  

### Backend
- Server Actions / API Routes  
- Prisma ORM  

### Database
- PostgreSQL  

### Blockchain Layer
- Initia (execution target)  
- Flow / Solana (interoperability vision)  

---

## 🆕 Recent Updates

### Deployed Contracts (Testnets)
- **Initia (testnet `initiation-2`)**
  - Deployed account/module address: `init1hepzz6uxjfvjggjdueq003n9tg0tc8f3nuztj5`
  - Publish tx hash: `29FE63D33A838FAA660A0AB827D0CECE3B850A772290D2513137F94019C4F7C6`
  - Explorer: `https://scan.testnet.initia.xyz/initiation-2/accounts/init1hepzz6uxjfvjggjdueq003n9tg0tc8f3nuztj5`

- **Flow (testnet)**
  - Contract address: `0xbcc2b6820b8f616d`
  - Deploy tx hash: `f91ee5f49cd76004b431537bd4e27deed33ed724f2e5b7b151d966d8afe9f86c`
  - Explorer: `https://testnet.flowscan.io/account/0xbcc2b6820b8f616d`

- **Solana (devnet)**
  - Program ID: `PMCjtbjN15YvMxPoXdsrmr35RRDV5W5ASVdVEbF6PX6`
  - Deploy signature: `5xDokgfhecfBYoxQMCXxxujro3LUUKJJQFJ81aj7V38UtJDzomKyGNoUeyVgU9XuA4yZcxCx7TvnZ7EwX2VJRH1r`
  - Explorer: `https://explorer.solana.com/address/PMCjtbjN15YvMxPoXdsrmr35RRDV5W5ASVdVEbF6PX6?cluster=devnet`

### Initia Contract (Move)
- The Move package was structured in `contracts/initia/` with `Move.toml` and the `arcade_escrow.move` module.
- The contract includes primitives for competitive flow and betting:
  - match creation/management with escrowed funds
  - bet placement
  - result resolution and settlement
- Frontend integration uses InterwovenKit with a compatible testnet network and wallet connect in the UI.

### Spectator Betting
- Support was added so users who are not playing the match can bet on a winner.
- Persistent database model:
  - new `MatchBet` entity in Prisma
  - relationship with match, betting user, and selected side
- Functional app flow:
  - server-side action to register a bet
  - display of total pool, bettor count, and user bet
  - betting panel in the match view

### Settlement and Economic Logic
- Settlement logic was updated to clearly separate:
  - main duel outcome
  - spectator bet settlement
  - platform fees
- Settlement now ensures consistent match closure and payout distribution based on final result.

### Migrations and Deployment
- The project was migrated to a Prisma schema with versioned migrations (`prisma/migrations`).
- The container flow includes a pre-start migration stage (`migrate deploy`).
- Environment-oriented configuration uses variables for local DB and in-container DB.

---

## ⚙️ Features Implemented

- Chessboard interface  
- Match creation system  
- Duel-trigger capture logic  
- Reflex-based mini-game (prototype)  
- Match orchestration engine  
- Wallet integration with InterwovenKit on testnet  
- Spectator betting (model + UI + actions)  
- Bet settlement and post-match payouts  
- Prisma schema with versioned migrations  
- Docker flow with automatic pre-start migration  

---

## 🎯 Target Users

- Competitive chess players  
- Casual gamers seeking interaction  
- Web3-native users  
- Streamers & content creators  
- Tournament organizers  

---

## 💡 Use Cases

- Competitive ranked matches  
- Paid 1v1 duels  
- Community tournaments  
- Creator-driven events  
- Seasonal leagues  

---

## 🌍 Vision

Arcade Chess Arena is the first step toward a new category:

> **Hybrid Strategy Games**

Where:
- thinking meets execution  
- turns meet real-time action  
- players don’t just plan — they perform  

This is not just chess onchain.

It’s:
- more intense  
- more social  
- more competitive  
- more alive  

---

## 🧪 Current Status

Functional MVP extended with a competitive economy.

✔ Core gameplay functional  
✔ Duel system implemented  
✔ Match flow operational  
✔ Spectator betting implemented in the app  
✔ Payout settlement integrated  
✔ Initia / Flow / Solana contracts deployed on testnets  
✔ Versioned migrations and Docker flow with pre-start migration  

### Next Steps
- Ranking & matchmaking  
- Tournament engine  
- Onchain prize pools in production  
- Advanced mini-games  
- Expanded production hardening and full multi-chain verification  

---

## 🏆 Why This Project Wins

- Instantly understandable  
- Immediately engaging  
- Visually demonstrable  
- Mechanically innovative  
- Built for competition  
- Built for Web3 **with purpose**  

---

## 👤 Team

Solo founder.  
Senior full-stack engineer.  
20+ years building systems end-to-end.

Focused on:
- rapid execution  
- product-first thinking  
- scalable architecture  

---

## 🔥 Final Thought

Chess has always been about **who thinks better**.

Arcade Chess Arena adds a new question:

> **Who performs better under pressure?**