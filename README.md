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

Arcade Chess Arena transforma una partida de ajedrez en una experiencia competitiva híbrida donde cada captura se resuelve con un duelo arcade en tiempo real. El producto está orientado a jugadores competitivos, creadores de torneos y comunidades Web3 que buscan partidas con más intensidad, resultados verificables y mayor retención. Su valor principal es unir estrategia clásica con ejecución mecánica bajo presión.

### Implementation Detail

- **The Custom Implementation**: Implementamos una capa de resolución de capturas basada en minijuegos sincronizados entre atacante y defensor, con validación de resultado y actualización del estado de partida en backend.
- **The Native Feature**: Integramos InterwovenKit en la app con `InterwovenKitProvider`, conexión de wallet en la barra superior y `enableAutoSign={true}` para habilitar el flujo de auto-firma en la cadena por defecto. Esto reduce fricción en operaciones repetitivas dentro del flujo competitivo.


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

## 🆕 Novedades Recientes

### Contrato en Initia (Move)
- Se estructuro el paquete Move en `contracts/initia/` con `Move.toml` y modulo `arcade_escrow.move`.
- El contrato incorpora primitives para flujo competitivo y apuestas:
  - creacion/gestion de partidas con fondos en escrow
  - colocacion de apuestas
  - resolucion y settlement de resultados
- La integracion de frontend usa InterwovenKit con red de testnet compatible y wallet connect en la UI.

### Apuestas de Espectadores
- Se agrego soporte para que usuarios que no juegan la partida puedan apostar por un ganador.
- Modelo persistente en base de datos:
  - nueva entidad `MatchBet` en Prisma
  - relacion con partida, usuario apostador y lado elegido
- Flujo funcional en aplicacion:
  - accion server-side para registrar apuesta
  - visualizacion de pool total, cantidad de apostadores y apuesta del usuario
  - panel de apuestas en la vista de partida

### Settlement y Logica Economica
- Se actualizo la logica de liquidacion para separar con claridad:
  - resultado del duelo principal
  - liquidacion de apuestas de espectadores
  - comisiones/plataforma
- El settlement contempla cierre consistente de partida y distribucion de payout segun resultado final.

### Migraciones y Despliegue
- Se migro a esquema de Prisma con migraciones versionadas (`prisma/migrations`).
- El flujo de contenedores incluye etapa de migracion previa al inicio de la app (`migrate deploy`).
- Configuracion orientada a entorno con variables para DB local y DB intra-contenedor.

---

## ⚙️ Features Implemented

- Chessboard interface  
- Match creation system  
- Duel-trigger capture logic  
- Reflex-based mini-game (prototype)  
- Match orchestration engine  
- Integracion wallet con InterwovenKit en testnet  
- Apuestas de espectadores (modelo + UI + acciones)  
- Settlement de apuestas y payouts post-partida  
- Esquema Prisma con migraciones versionadas  
- Flujo docker con migracion automatica previa al arranque  

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

MVP funcional y extendido con economia competitiva.

✔ Core gameplay functional  
✔ Duel system implemented  
✔ Match flow operational  
✔ Apuestas de espectadores implementadas en app  
✔ Settlement de payouts integrado  
✔ Contrato Initia (Move) estructurado en repositorio  
✔ Migraciones versionadas y flujo docker con migracion previa  

### Next Steps
- Ranking & matchmaking  
- Tournament engine  
- Prize pools onchain en produccion  
- Advanced mini-games  
- Deployment y verificacion completa de contratos multi-chain  

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