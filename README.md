# Stake Mine — Backend Starter

A production-style Node.js backend starter for the **Stake Mine** game application. This project provides a clean foundation using Express, MySQL 8, and Redis 7, fully containerized with Docker and Docker Compose.

---

## Prerequisites

To run this project, you need the following installed:
- [Docker](https://www.docker.com/products/docker-desktop)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js (LTS)](https://nodejs.org/) (optional, only for local development outside Docker)

---

## Project Structure

This project follows a clean architecture separating HTTP routing, controller orchestration, business services, and database queries (Repository pattern).

```
stake-mine/
│
├── backend/
│   ├── src/
│   │   ├── config/          # Configurations for Env, MySQL, and Redis clients
│   │   ├── controllers/     # HTTP Layer: Parses request data, calls services, sends HTTP response
│   │   ├── services/        # Business Logic Layer: Validates rules, coordinates db & caching logic
│   │   ├── repositories/    # Data Access Layer: Performs raw SQL database queries
│   │   ├── routes/          # Express route registration (grouped by resource)
│   │   ├── middleware/      # Logger, global error handler, 404, and rate limiters
│   │   ├── models/          # JSDoc type specifications (data shapes)
│   │   ├── utils/           # Shared helper functions
│   │   ├── logger/          # Winston logger setup
│   │   ├── app.js           # Express app factory (registers middlewares & routes)
│   │   └── server.js        # Server entry point (verifies connections, starts HTTP listener)
│   │
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
│
├── mysql/
│   └── init.sql             # MySQL schema definition & seed data
│
├── docker-compose.yml       # Docker Compose infrastructure setup
└── README.md
```

---

## Architectural Flow & Caching

The project implements a clean layered design:
`Client Request → Express Router → Controller → Service → Repository → Database`

### Redis Cache Read-Through Flow

When reading a user profile by ID (`GET /api/v1/users/:id`), the user service applies a read-through caching strategy using Redis:

```
                  ┌──────────────────────┐
                  │   Client Request     │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Check Redis Cache    │
                  └──────────┬───────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
        [ Cache HIT ]                 [ Cache MISS ]
              │                             │
    Retrieve from Redis            Query MySQL Database
              │                             │
              │                             ▼
              │                     Save in Redis Cache
              │                             │
              └──────────────┬──────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │    Return Response   │
                  └──────────────────────┘
```

- **Redis Cache Key:** `user:<user_id>`
- **Cache Expiration (TTL):** Configurable via `REDIS_CACHE_TTL` (default 3600 seconds / 1 hour).
- **Cache Invalidation:** The cache is automatically populated on both creation (`POST /api/v1/users`) and on first-fetch miss.

---

## Database Schema (MySQL)

MySQL is the primary database. The database is initialized automatically with the following structure:
- **`users` Table:** Stores player details (`id`, `username`, `email`, `balance` defaulting to 1000.00, timestamps).
- **`games` Table:** Stores game session history (`id`, `user_id` foreign key, `bet_amount`, `mines`, `result` of 'won'/'lost'/'active', `payout`, timestamps).
- **Seed Data:** Initializes a test user `Yash` (balance 5000.00) and `Demo` (balance 1000.00).

---

## Docker Compose Services

Docker Compose manages and networks 5 distinct services:

1. **`backend`**: Node.js Alpine image running the Express application.
2. **`mysql`**: MySQL 8 database service containing user balances and game records.
3. **`redis`**: Redis 7 cache service running on Alpine.
4. **`phpmyadmin`**: A web-based graphical user interface for managing the MySQL database, accessible on port `8080`.
5. **`redis-insight`**: A developer-focused graphical user interface for monitoring and querying the Redis server, accessible on port `5540`.

---

## Quick Start (Docker)

To run the entire system in a production-style containerized environment:

```bash
# 1. Copy the template env file
cp backend/.env.example backend/.env

# 2. Build and start all services
docker compose up --build

# 3. Stop the services
docker compose down

# 4. Stop and delete database volumes (factory reset)
docker compose down -v
```

### Port Mappings

Once running, you can access the services on these ports:
- **Backend API:** `http://localhost:3000`
- **phpMyAdmin (MySQL GUI):** `http://localhost:8080` (Log in with DB User `yash` / Password `yash123`)
- **RedisInsight (Redis GUI):** `http://localhost:5540`

---

## API Endpoints

### 1. Base & Health Check
- **`GET /`**  
  Returns API welcome status.
- **`GET /health`**  
  Checks connection health of MySQL and Redis services. Returns `503` if any service is down.

### 2. Users
- **`GET /api/v1/users`**  
  Lists all users.
- **`GET /api/v1/users/:id`**  
  Fetches a single user. Checks Redis cache first.
- **`POST /api/v1/users`**  
  Creates a new user. Performs validation (blank checks, email regex format validation, balance validation) and returns `409` on duplicate email constraint.
  - Body example:
    ```json
    {
      "username": "Alice",
      "email": "alice@example.com",
      "balance": 2500
    }
    ```

### 3. Game (Stub Endpoints)
Endpoints reserved for the upcoming game engine:
- **`POST /api/v1/game/start`**
- **`POST /api/v1/game/reveal`**
- **`POST /api/v1/game/cashout`**

> **Note:** Game routes return `501 Not Implemented` with TODO comments indicating where the mine-generation and cash-out algorithms will reside.
