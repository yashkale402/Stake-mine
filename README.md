# Stake Mine

Brief summary
---------------
Stake Mine is a two-tier web application: a Node.js backend that implements a cryptographically-secure "mine" betting game, and a Next.js frontend that provides the player UI. The system uses MySQL as the source of truth and Redis as a caching/coordination layer. The repo is containerised with `docker-compose.yml` for easy local/dev runs.

**Key components**
- **Backend**: [backend/](backend/) — Express app with controllers, services, repositories, Redis cache, MySQL persistence.
- **Frontend**: [frontend/](frontend/) — Next.js app communicating with backend APIs.
- **Database**: [mysql/init.sql](mysql/init.sql) — schema and initial data.
- **Orchestration**: `docker-compose.yml` — compose for backend, frontend, MySQL, Redis (dev convenience).

How it works (high level)
-------------------------
- Player actions originate from the frontend which calls REST API endpoints on the backend.
- Controllers validate requests and call Service layer functions (e.g. game lifecycle in `backend/src/services/game.service.js`).
- Services coordinate domain logic, call Repositories for DB access, and use CacheRepository for Redis operations.
- MySQL stores canonical records (games, history, users). Redis stores active game state, idempotency keys and distributed locks to improve latency and ensure safe concurrency.

Core algorithms (brief)
----------------------
- **Mine generation (CSPRNG + partial Fisher–Yates)**
  - Implemented in `backend/src/services/game.service.js` via a cryptographically-secure partial Fisher–Yates shuffle to produce `mine_positions` at game start. Mines are generated once per game and are immutable for that game's lifetime.
- **Multiplier calculation (actuarial probability)**
  - The visible multiplier is computed from the probability of revealing only safe cells so far, adjusted by a configured house edge. Implemented as an incremental product to avoid factorials (see `computeMultiplier` in `game.service.js`).
- **Risk engine**
  - `backend/src/services/risk-engine.js` adjusts `mineCount` and `houseEdge` based on slot budget usage, player lifecycle (new player protection), and session loss streaks. This feeds into mine generation to balance payouts vs budget.

Important data flows
--------------------
- Start Game: frontend -> controller -> `startGame()` service →
  - validate, compute risk profile, generate `mine_positions` (CSPRNG), debit player (MySQL TX), create game row, cache full game state in Redis, set active-game pointer.
- Reveal Cell: frontend -> controller -> `revealCell()` service →
  - load state (Redis primary, MySQL fallback), idempotency check (Redis), check membership in pre-generated `mine_positions`, then either handle safe reveal (update multiplier, persist reveal state) or handle mine hit (settle loss in MySQL transaction, clear Redis).
- Cashout: frontend -> controller -> `cashout()` service →
  - acquire Redis cashout lock, recompute payout from cached multiplier, perform MySQL transaction to credit wallet and mark game settled, insert history, update slot budget ledger, clear Redis state, release lock.

Concurrency & consistency
-------------------------
- Redis is used for low-latency active state and coordination (locks, idempotency, active-game pointer).
- MySQL is the single source of truth; critical money actions (debit/credit, final settlement) happen inside MySQL transactions to ensure atomicity.
- Cashouts use a distributed lock (Redis SET NX) plus conditional MySQL UPDATE (WHERE status='ACTIVE') to prevent double-settlement.
- Reveal idempotency keys stored in Redis prevent duplicate processing when clients retry.

Caching strategy and fallbacks
-----------------------------
- Active game state and budget ledgers are cached in Redis with TTLs. On Redis miss the services recover from MySQL and repopulate the cache.
- Redis failures are logged but intentionally do not crash the game flow — MySQL fallbacks ensure correctness.

Files to inspect for the implementation details
----------------------------------------------
- Game lifecycle & algorithms: [backend/src/services/game.service.js](backend/src/services/game.service.js)
- Risk engine: [backend/src/services/risk-engine.js](backend/src/services/risk-engine.js)
- Redis access / locking / idempotency: [backend/src/repositories/cache.repository.js](backend/src/repositories/cache.repository.js)
- Repositories (DB access): [backend/src/repositories/](backend/src/repositories/)
- Frontend API client: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)
- Docker compose: [docker-compose.yml](docker-compose.yml)

Quickstart (dev)
---------------
1. Start services:

```powershell
docker compose up -d
```

2. Backend logs and tests:

```powershell
cd backend
npm install
npm test
```

Notes & next steps
------------------
- This README is a concise summary. If you want, I can:
  - Add sequence diagrams (Mermaid) for start/reveal/cashout.
  - Extract a one-page design doc for fairness & audits.
  - Draft environment variable docs and local dev checklist.
<div align="center">

# 💣 Stake Mine

**A production-ready, full-stack real-time mines casino game**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js)](https://nodejs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8-blue?logo=mysql)](https://mysql.com)
[![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)](https://redis.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

Pick gems. Dodge mines. Cash out before it's too late.

</div>

---

## ✨ Features

| Area | What's included |
|---|---|
| 🎮 **Gameplay** | Bet, reveal tiles, live multiplier, cashout, session restore |
| 🔐 **Auth** | JWT login/register, role-based routing (Player / Admin) |
| 📈 **Progression** | XP levels, titles, missions, badges, daily rewards, leaderboard |
| 🛡️ **Fairness** | Immutable board, cryptographic mine generation, fairness API |
| 🧑‍💼 **Admin** | Runtime config, KPI dashboard, slot analytics, player visibility, audit history |
| 🎨 **UI** | Framer Motion animations, 3D tile flips, particle bursts, sparkline, mobile-first |
| 🔊 **Audio** | Lightweight generated sound feedback with mute toggle |

---

## 🖥️ Tech Stack

### Backend
- **Node.js** + **Express** — REST API
- **MySQL 8** — source of truth (wallets, sessions, history)
- **Redis 7** — active game state, distributed locks, config cache
- **JWT** — stateless authentication
- **Winston** — structured logging

### Frontend
- **Next.js 14** App Router + **TypeScript**
- **Tailwind CSS** + **Framer Motion**
- **Zustand** — client state (with localStorage persistence for preferences)
- **React Hot Toast** — in-game notifications

### Infra
- **Docker Compose** — one-command local stack
- **phpMyAdmin** — DB browser
- **RedisInsight** — Redis browser

---

## 🏗️ Architecture

```mermaid
flowchart LR
    Browser["🌐 Browser"] --> FE["Next.js Frontend :3000"]
    FE --> API["Express API :3001 /api/v1"]
    API --> SVC["Service Layer"]
    SVC --> MySQL["MySQL 8"]
    SVC --> Redis["Redis 7"]
```

### Backend Layers

```
Routes → Controllers → Services → Repositories → MySQL / Redis
```

- **Routes** — define endpoints and apply middleware
- **Controllers** — validate input, shape responses
- **Services** — enforce business rules and game logic
- **Repositories** — all persistence operations (MySQL + Redis)

---

## 📁 Project Structure

```
Stake-mine/
├── backend/
│   └── src/
│       ├── config/         # env, mysql, redis, migrations
│       ├── controllers/    # auth, game, user, admin, health
│       ├── middleware/     # auth, rate-limit, error, request logging
│       ├── repositories/   # MySQL + Redis access
│       ├── routes/         # versioned API modules
│       ├── services/       # game engine + business logic
│       ├── utils/          # response helpers
│       ├── app.js
│       └── server.js
├── frontend/
│   └── src/
│       ├── app/            # Next.js pages (/, /login, /history, /admin)
│       ├── components/     # GameBoard, GameControls, Navbar, panels
│       ├── lib/            # axios client, audio, expiry hook
│       └── store/          # Zustand stores (auth, game)
├── mysql/
│   └── init.sql            # schema + seed data
├── docker-compose.yml
└── README.md
```

---

## 🎮 Game Engine Guarantees

> These rules make the game provably fair within each round.

1. Mine positions are generated **once** at round start using cryptographically secure randomness
2. The board is **immutable** — reveals never recalculate or move mines
3. Mine positions are stored in both **Redis** (speed) and **MySQL** (durability)
4. Cashout is protected by a **Redis distributed lock** + **MySQL conditional settlement** (rows-affected check) to prevent double payouts
5. MySQL is always the **source of truth** — Redis is rebuilt from DB on recovery

---

## 🔄 Core Flows

<details>
<summary><strong>Gameplay Flow</strong></summary>

```mermaid
flowchart TD
    A["Player starts round"] --> B["Validate user + bet"]
    B --> C["Load effective config"]
    C --> D["Generate immutable mine positions"]
    D --> E["MySQL: debit wallet + create session"]
    E --> F["Redis: store active game state"]
    F --> G["Frontend renders board"]
    G --> H["Player reveals tile"]
    H --> I["Check cell vs locked mine_positions"]
    I --> J{Mine hit?}
    J -- Yes --> K["LOST → reveal mines → write history"]
    J -- No --> L["Update multiplier + revealed cells"]
    L --> M{Cashout?}
    M -- Yes --> N["Lock → settle payout → write history"]
    M -- No --> H
```

</details>

<details>
<summary><strong>Cashout Protection Flow</strong></summary>

```mermaid
flowchart TD
    A["Cashout request"] --> B["Acquire Redis lock"]
    B --> C{Lock acquired?}
    C -- No --> D["Reject concurrent cashout"]
    C -- Yes --> E["Re-read game state"]
    E --> F["Compute payout"]
    F --> G["MySQL: credit wallet + settle if ACTIVE"]
    G --> H{rows affected = 1?}
    H -- No --> I["Rollback — duplicate settlement blocked"]
    H -- Yes --> J["Insert history + update budget ledger"]
    J --> K["Clear Redis state + release lock"]
```

</details>

<details>
<summary><strong>Session Restore Flow</strong></summary>

```mermaid
flowchart TD
    A["Dashboard loads"] --> B["GET /game/active"]
    B --> C{Redis pointer exists?}
    C -- Yes --> D["Load from Redis"]
    C -- No --> E["Fallback: MySQL ACTIVE session lookup"]
    E --> F{Found?}
    F -- No --> G["No restore — fresh state"]
    F -- Yes --> H["Rebuild Redis from DB row"]
    D --> I["Return sanitized active game to frontend"]
    H --> I
```

</details>

---

## 🚀 Quick Start

### Option 1 — Docker Compose (recommended)

```bash
git clone https://github.com/yashkale402/Stake-mine.git
cd Stake-mine
docker-compose up --build -d
```

| Service | URL |
|---|---|
| Backend API | http://localhost:3001 |
| Frontend | http://localhost:3000 |
| phpMyAdmin | http://localhost:8080 |
| RedisInsight | http://localhost:5540 |

### Option 2 — Local Dev

```bash
# Terminal 1 — Backend
cd backend && npm install && npm run dev

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

---

## ⚙️ Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
PORT=3001
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=stake_mine
MYSQL_USER=root
MYSQL_PASSWORD=yourpassword
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret
```

---

## 🔑 Dev Accounts

| Role | Email | Password |
|---|---|---|
| Player | `yash@example.com` | `password123` |
| Player | `demo@example.com` | `password123` |
| Admin | `admin@stake.mine` | `password123` |

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register new player |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| GET | `/api/v1/auth/me` | Get current user |

### Game
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/game/start` | Start a new round |
| POST | `/api/v1/game/reveal` | Reveal a tile |
| POST | `/api/v1/game/cashout` | Cash out current round |
| GET | `/api/v1/game/active` | Get active session |
| GET | `/api/v1/game/history` | Game history |
| GET | `/api/v1/game/fairness` | Fairness explanation |

### User
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/users/deposit` | Add balance |
| GET | `/api/v1/users/engagement` | Progression + missions + badges |
| POST | `/api/v1/users/daily-reward/claim` | Claim daily reward |
| GET | `/api/v1/users/leaderboard` | Top players |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/admin/summary` | KPI dashboard |
| GET/PUT | `/api/v1/admin/config` | Runtime config |
| GET | `/api/v1/admin/config-history` | Config audit log |
| GET | `/api/v1/admin/players` | Recent players |
| GET | `/api/v1/admin/slots` | Slot analytics |

---

## 💡 Example Requests

```http
# Login
POST /api/v1/auth/login
{ "email": "yash@example.com", "password": "password123" }

# Start game
POST /api/v1/game/start
Authorization: Bearer <TOKEN>
{ "betAmountPaise": 1000, "mineCount": 3 }

# Reveal tile
POST /api/v1/game/reveal
Authorization: Bearer <TOKEN>
{ "gameUuid": "<UUID>", "cellIndex": 4 }

# Cashout
POST /api/v1/game/cashout
Authorization: Bearer <TOKEN>
{ "gameUuid": "<UUID>" }
```

---

## 🧪 Tests

```bash
cd backend && npm test
```

Covers: mine generation, multiplier growth, streak logic, daily reward availability, engagement profile generation.

---

## 🗄️ Data Model

| Table | Purpose |
|---|---|
| `users` | Accounts + wallet balance |
| `game_sessions` | Active and completed rounds |
| `game_history` | Settled round records |
| `global_config` | Runtime game parameters |
| `slot_configs` | Per-slot configuration |
| `slot_budget_ledger` | House P&L tracking |
| `audit_logs` | Admin action history |
| `player_config_overrides` | Per-player config overrides |

---

## 🗺️ Roadmap

- [ ] Provably-fair cryptographic proof page
- [ ] WebSocket live multiplier push (replace polling)
- [ ] Integration test suite (API-level)
- [ ] Social / referral system
- [ ] Persistent mission completion state
- [ ] Push / in-app notifications
- [ ] Stronger admin player-management actions

---

## 📄 License

MIT — built for learning and demonstration purposes.

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/yashkale402">yashkale402</a>
</div>
