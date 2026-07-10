-- ──────────────────────────────────────────────────────────────────────────────
-- init.sql
-- MySQL initialization script — runs automatically on first container startup.
-- ──────────────────────────────────────────────────────────────────────────────

-- Ensure we're using the right database
USE stake_mine;

-- ── Users Table ───────────────────────────────────────────────────────────────
-- Stores registered player accounts with their balance.
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(100)   NOT NULL,
    email       VARCHAR(100)   UNIQUE NOT NULL,
    balance     DECIMAL(10,2)  NOT NULL DEFAULT 1000.00,
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Games Table ───────────────────────────────────────────────────────────────
-- Records every game session played.
-- 'result' will be set to 'won', 'lost', or left NULL while game is 'active'.
CREATE TABLE IF NOT EXISTS games (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT            NOT NULL,
    bet_amount  DECIMAL(10,2)  NOT NULL,
    mines       INT            NOT NULL,
    result      VARCHAR(20)    DEFAULT NULL COMMENT 'won | lost | active',
    payout      DECIMAL(10,2)  DEFAULT 0.00,
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_games_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Note: MySQL 8 does not support CREATE INDEX IF NOT EXISTS.
-- This init script only runs once (on first container start), so the tables
-- are always freshly created above — plain CREATE INDEX is safe here.
CREATE INDEX idx_games_user_id ON games (user_id);
CREATE INDEX idx_games_result  ON games (result);

-- ── Seed Data ─────────────────────────────────────────────────────────────────
INSERT INTO users (username, email, balance)
VALUES
    ('Yash', 'yash@example.com', 5000.00),
    ('Demo', 'demo@example.com', 1000.00)
ON DUPLICATE KEY UPDATE username = VALUES(username);