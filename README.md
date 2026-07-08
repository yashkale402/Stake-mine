# Stake Mine — Backend

> A production-style Node.js backend for the **Stake Mine** game.  
> Built with **Express**, **MySQL 8**, **Redis 7**, and **Docker**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS |
| Framework | Express.js |
| Database | MySQL 8 |
| Cache | Redis 7 |
| Logger | Winston |
| Containers | Docker + Docker Compose |

---

## Project Structure

```
stake-mine/
│
├── backend/
│   ├── src/
│   │   ├── config/          # DB & env configuration
│   │   ├── controllers/     # HTTP layer — parse request, send response
│   │   ├── services/        # Business logic layer
│   │   ├── repositories/    # Data access layer (raw SQL)
│   │   ├── routes/          # Route definitions
│   │   ├── middleware/      # Error handler, rate limiter, logger, 404
│   │   ├── models/          # Schema typedefs (no ORM)
│   │   ├── utils/           # Shared helpers
│   │   ├── logger/          # Winston logger setup
│   │   ├── app.js           # Express app factory
│   │   └── server.js        # Entry point — starts HTTP server
│   │
│   ├── Dockerfile
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
│
├── mysql/
│   └── init.sql             # DB schema + seed data
│
├── docker-compose.yml
└── README.md
```

---

## Quick Start (Docker)

```bash
# 1. Clone the repo
git clone <repo-url>
cd stake-mine

# 2. Copy environment file
cp backend/.env.example backend/.env

# 3. Start all services
docker compose up --build

# 4. Stop all services
docker compose down

# 5. Stop and remove volumes (clean slate)
docker compose down -v
```

### Service URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| phpMyAdmin | http://localhost:8080 |
| RedisInsight | http://localhost:5540 |

---

## Local Development (without Docker)

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and point MYSQL_HOST/REDIS_HOST to localhost
npm run dev
```

---

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | MySQL + Redis status |

**Response:**
```json
{
  "success": true,
  "mysql": "connected",
  "redis": "connected",
  "uptime": "42s",
  "timestamp": "2026-07-08T13:00:00.000Z"
}
```

---

### Users — `/api/v1/users`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List all users |
| GET | `/api/v1/users/:id` | Get user by ID (Redis cached) |
| POST | `/api/v1/users` | Create a new user |

**POST body:**
```json
{
  "username": "Alice",
  "email": "alice@example.com",
  "balance": 2000
}
```

---

### Game — `/api/v1/game` *(placeholder — 501 Not Implemented)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/game/start` | Start a new game |
| POST | `/api/v1/game/reveal` | Reveal a tile |
| POST | `/api/v1/game/cashout` | Cash out winnings |

> ⚠️ Game endpoints return `501 Not Implemented`.  
> The game algorithm will be added in a future iteration.

---

## Redis Caching

The `GET /api/v1/users/:id` endpoint demonstrates a **read-through cache** pattern:

```
Request → Check Redis
              │
        ┌─────┴──────┐
      HIT            MISS
        │              │
   Return cache    Query MySQL
                      │
                  Store in Redis
                      │
                  Return data
```

- Cache key format: `user:<id>`
- TTL: **3600 seconds** (1 hour) — configurable via `REDIS_CACHE_TTL`
- Cache is **written** on create and on first-fetch miss
- Redis failures degrade gracefully — the app keeps working via MySQL

---

## MySQL

- Uses `mysql2/promise` with a **connection pool** (10 connections max)
- Schema defined in `mysql/init.sql` — auto-runs on first Docker startup
- Two tables: `users`, `games`
- No ORM — raw SQL queries in the repository layer for clarity

---

## Logging

Winston is configured with three outputs:

| Output | Level | File |
|--------|-------|------|
| Console | all | — |
| File | error | `logs/error.log` |
| File | all | `logs/combined.log` |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment |
| `MYSQL_HOST` | `mysql` | MySQL hostname |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_DATABASE` | `stake_mine` | Database name |
| `MYSQL_USER` | — | MySQL username |
| `MYSQL_PASSWORD` | — | MySQL password |
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_CACHE_TTL` | `3600` | Cache TTL in seconds |
