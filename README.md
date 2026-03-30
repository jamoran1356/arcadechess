# ♟️ Arcade Chess Arena  
**Every capture becomes a duel.**

Arcade Chess Arena is a next-generation competitive chess experience where every capture is no longer automatic — it becomes a real-time skill duel.

Built for **Initia, Flow, and Solana**, this project transforms traditional chess into a hybrid strategy + reflex game powered by onchain competition.

## Initia Hackathon Submission

- **Project Name**: Arcade Chess Arena
- **Rollup Chain ID**: initia-testnet
- **Deployment Reference**: https://testnet.flowscan.io/account/0xbcc2b6820b8f616d
- **Txn Reference**: https://testnet.flowscan.io/transaction/f91ee5f49cd76004b431537bd4e27deed33ed724f2e5b7b151d966d8afe9f86c

### Project Overview

Arcade Chess Arena convierte una captura de ajedrez en un duelo arcade en tiempo real para decidir si la pieza realmente se toma. El producto apunta a jugadores competitivos y comunidades que quieren partidas con mayor tensión, más espectáculo y resultados verificables. La propuesta de valor es combinar estrategia clásica con ejecución bajo presión, creando una experiencia más dinámica y apta para torneos onchain.

### Implementation Detail

- **The Custom Implementation**: Implementamos una capa de resolución de capturas basada en minijuegos (targets, memory y key-clash), sincronizada entre atacante y defensor. El backend valida resultados, resuelve el estado de tablero y registra la actividad transaccional para stakes y flujo de partida.
- **The Native Feature**: La entrega está preparada para el flujo de **auto-signing** en UX de transacciones dentro del lobby y acciones de partida, reduciendo fricción en operaciones repetitivas de match/stake para una experiencia de juego más fluida.


## 🚀 Overview

In traditional chess, capturing a piece is purely based on position.

In Arcade Chess Arena:
- When a player enters an occupied square,
- both players must complete a **real-time reflex mini-game**,
- the fastest player wins the duel,
- and earns control of the square.

This introduces a new dimension to chess:
> Strategy decides the move. Skill decides the outcome.

---

## 🎮 Core Gameplay

- Classical chess rules still apply
- Captures are replaced by **arcade duels**
- Both players compete simultaneously
- The best time wins the square
- If you lose the duel, your move fails

This creates:
- higher tension
- more interaction
- real-time competitive moments
- deeper gameplay

---

## ⚡ Why This Matters

Chess is one of the most iconic games ever created — but its digital versions are often passive for modern audiences.

Arcade Chess Arena introduces:
- **active engagement**
- **skill-based resolution**
- **spectator-friendly moments**
- **competitive intensity**

It turns chess into something:
- more dynamic
- more entertaining
- more replayable

---

## ⛓️ Blockchain Integration

This project uses blockchain **as competitive infrastructure**, not as decoration.

Powered by **Initia, Flow, and Solana**, the system enables:

- 🏆 Onchain tournaments  
- 💰 Paid matches and competitive lobbies  
- 🧾 Verifiable match results  
- 📊 Player progression and history  
- 🌐 Decentralized competition hosting  

Players can:
- create matches
- set entry fees
- compete for rewards
- host tournaments
- build communities around gameplay

---

## 🧠 Key Innovation

The core innovation is simple but powerful:

> Every capture becomes a moment of real competition.

This mechanic:
- preserves chess fundamentals
- adds real-time pressure
- rewards execution, not just planning
- creates natural highlight moments

---

## 🏗️ Architecture (MVP)

The current MVP focuses on delivering a functional and demo-ready system.

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
- Initia (primary integration target)
- Flow / Solana (cross-ecosystem vision)

### Features implemented
- Basic chess interface
- Match creation
- Duel trigger system (capture logic)
- Reflex-based mini-game (prototype)
- Match flow orchestration
- Onchain-ready architecture for tournaments

---

## 🧪 How It Works (Flow)

1. Player creates or joins a match  
2. Game starts with standard chess rules  
3. When a capture is attempted:
   - duel is triggered  
   - both players enter mini-game  
   - timer starts  
4. Fastest player wins  
5. Board updates accordingly  
6. Game continues  

---

## 🧩 Mini-Game Concept

The duel is a fast reflex challenge designed to:
- be completed in seconds
- require precision and speed
- be fair and repeatable

Examples (current and future):
- click timing challenge
- reaction speed test
- pattern matching
- aim-based interactions

---

## 🧑‍🤝‍🧑 Target Users

- Chess players looking for a new competitive format  
- Casual gamers who want more interaction  
- Web3 users interested in paid competition  
- Streamers and content creators  
- Tournament organizers  

---

## 💡 Use Cases

- Friendly matches with a twist  
- Ranked competitive play  
- Paid 1v1 duels  
- Community tournaments  
- Creator-led events  
- Seasonal leagues  

---

## 🌍 Vision

Arcade Chess Arena aims to redefine strategy games by introducing real-time skill layers into traditionally turn-based systems.

This is not just chess on blockchain.

It is:
- more interactive  
- more competitive  
- more social  
- more alive  

We believe the future of strategy games lies in combining:
- thinking
- execution
- ownership
- community-driven competition

---

## 🧪 Current Status

This project is an MVP built for hackathon submission.

It demonstrates:
- core gameplay innovation  
- duel-based capture system  
- functional match flow  
- integration-ready blockchain architecture  

Future iterations will expand:
- tournament systems  
- ranking and matchmaking  
- onchain prize pools  
- advanced mini-games  
- spectator mode  

---

## 🏆 Why This Project

Arcade Chess Arena is designed to:
- be instantly understandable  
- be memorable after one demo  
- introduce real gameplay innovation  
- leverage blockchain meaningfully  
- create strong competitive loops  

---

## 👤 Team

Solo founder and senior full-stack engineer with 20+ years of experience, focused on rapid product development and building complete systems end-to-end.

---
