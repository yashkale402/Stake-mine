-- ──────────────────────────────────────────────────────────────────────────────
-- init.sql
-- Stake Mine — Full Production Schema
-- Runs automatically on first MySQL container startup.
-- ──────────────────────────────────────────────────────────────────────────────

USE stake_mine;

-- ── 1. USERS ──────────────────────────────────────────────────────────────────
-- Core player accounts. Balance stored in paise (integer) to avoid float errors.
-- 1 rupee = 100 paise. E.g. ₹100.00 = 10000 paise.
CREATE TABLE IF NOT EXISTS users (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    UNIQUE NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    -- Balance in PAISE (integer). Eliminates all decimal rounding issues.
    balance_paise   BIGINT          NOT NULL DEFAULT 0,
    role            ENUM('PLAYER','ADMIN') NOT NULL DEFAULT 'PLAYER',
    status          ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email  (email),
    INDEX idx_status (status),
    INDEX idx_role   (role)
);

-- ── 2. GLOBAL CONFIG ──────────────────────────────────────────────────────────
-- Admin-controlled key-value configuration store.
-- All game behaviour flows from here. No hardcoded values in service code.
CREATE TABLE IF NOT EXISTS global_config (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    config_key      VARCHAR(100)    NOT NULL UNIQUE,
    config_value    JSON            NOT NULL,
    description     TEXT,
    updated_by      VARCHAR(100)    NOT NULL DEFAULT 'system',
    version         INT             NOT NULL DEFAULT 1,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_config_key (config_key)
);

-- ── 3. SLOT CONFIGS ───────────────────────────────────────────────────────────
-- Defines time-based budget windows (e.g. 00:00–06:00 with ₹5000 budget).
CREATE TABLE IF NOT EXISTS slot_configs (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    slot_name       VARCHAR(50)     NOT NULL,
    start_hour      TINYINT         NOT NULL COMMENT '0-23',
    end_hour        TINYINT         NOT NULL COMMENT '0-23',
    -- Budget in PAISE.
    budget_paise    BIGINT          NOT NULL,
    pacing_strategy ENUM('TIME_ELAPSED','GAME_COUNT','ADAPTIVE') NOT NULL DEFAULT 'ADAPTIVE',
    pacing_config   JSON            NOT NULL DEFAULT ('{}'),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    timezone        VARCHAR(50)     NOT NULL DEFAULT 'Asia/Kolkata',
    updated_by      VARCHAR(100)    NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_hours_active (start_hour, end_hour, is_active)
);

-- ── 4. SLOT BUDGET LEDGER ─────────────────────────────────────────────────────
-- Daily budget tracking per slot. One row per (slot, date).
-- Preserves historical data; never overwrites slot_configs budget.
CREATE TABLE IF NOT EXISTS slot_budget_ledger (
    id                  BIGINT          AUTO_INCREMENT PRIMARY KEY,
    slot_id             INT             NOT NULL,
    slot_date           DATE            NOT NULL,
    total_budget_paise  BIGINT          NOT NULL,
    spent_paise         BIGINT          NOT NULL DEFAULT 0,
    game_count          INT             NOT NULL DEFAULT 0,
    last_updated        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_slot_date (slot_id, slot_date),
    INDEX idx_slot_date (slot_id, slot_date),
    CONSTRAINT fk_ledger_slot FOREIGN KEY (slot_id) REFERENCES slot_configs(id) ON DELETE RESTRICT
);

-- ── 5. GAME SESSIONS ──────────────────────────────────────────────────────────
-- Every game played. Redis is the working state; this is the source of truth.
-- mine_positions revealed only after game ends.
CREATE TABLE IF NOT EXISTS game_sessions (
    id                  BIGINT          AUTO_INCREMENT PRIMARY KEY,
    game_uuid           CHAR(36)        NOT NULL UNIQUE COMMENT 'UUID exposed to client',
    user_id             INT             NOT NULL,
    slot_ledger_id      BIGINT,
    bet_amount_paise    BIGINT          NOT NULL,
    mine_count          INT             NOT NULL,
    board_size          INT             NOT NULL DEFAULT 25,
    status              ENUM('ACTIVE','CASHED_OUT','LOST','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    revealed_cells      JSON            NOT NULL DEFAULT ('[]'),
    mine_positions      JSON            NULL     COMMENT 'Hidden during play; revealed on game end',
    current_multiplier  DECIMAL(10,4)   NOT NULL DEFAULT 1.0000,
    payout_paise        BIGINT          NOT NULL DEFAULT 0,
    -- Snapshot of config at game-start so mid-slot admin changes do not affect active games.
    config_snapshot     JSON            NOT NULL DEFAULT ('{}'),
    started_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at            TIMESTAMP       NULL,
    expires_at          TIMESTAMP       NOT NULL,

    INDEX idx_user_status   (user_id, status),
    INDEX idx_expires        (expires_at),
    INDEX idx_uuid           (game_uuid),
    CONSTRAINT fk_game_user   FOREIGN KEY (user_id)         REFERENCES users(id)              ON DELETE RESTRICT,
    CONSTRAINT fk_game_ledger FOREIGN KEY (slot_ledger_id)  REFERENCES slot_budget_ledger(id) ON DELETE SET NULL
);

-- ── 6. GAME HISTORY ───────────────────────────────────────────────────────────
-- Denormalized, write-once record created after every game settlement.
-- Optimised for fast player history reads. Never mutated after insert.
CREATE TABLE IF NOT EXISTS game_history (
    id                  BIGINT          AUTO_INCREMENT PRIMARY KEY,
    game_uuid           CHAR(36)        NOT NULL UNIQUE,
    user_id             INT             NOT NULL,
    bet_amount_paise    BIGINT          NOT NULL,
    payout_paise        BIGINT          NOT NULL,
    profit_loss_paise   BIGINT          NOT NULL COMMENT 'payout - bet; negative = loss',
    mine_count          INT             NOT NULL,
    cells_revealed      INT             NOT NULL DEFAULT 0,
    final_multiplier    DECIMAL(10,4)   NOT NULL,
    outcome             ENUM('WIN','LOSS','CASHOUT') NOT NULL,
    slot_id             INT,
    played_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_played   (user_id, played_at DESC),
    INDEX idx_outcome       (user_id, outcome, played_at DESC),
    INDEX idx_slot_played   (slot_id, played_at DESC),
    CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- ── 7. AUDIT LOGS ─────────────────────────────────────────────────────────────
-- Immutable record of every significant action for compliance & debugging.
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    entity_type     VARCHAR(50)     NOT NULL COMMENT 'GAME | CONFIG | USER | WALLET',
    entity_id       VARCHAR(100)    NOT NULL,
    action          VARCHAR(100)    NOT NULL COMMENT 'GAME_START | MINE_HIT | CASHOUT | CONFIG_UPDATE...',
    actor           VARCHAR(100)    NOT NULL COMMENT 'userId or adminId',
    payload         JSON,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_entity (entity_type, entity_id, created_at DESC),
    INDEX idx_actor  (actor, created_at DESC)
);

-- ── 8. PLAYER CONFIG OVERRIDES ────────────────────────────────────────────────
-- Time-bound per-player overrides on top of global_config.
-- effectiveTo = NULL means active indefinitely.
CREATE TABLE IF NOT EXISTS player_config_overrides (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    config_key      VARCHAR(100)    NOT NULL,
    config_value    JSON            NOT NULL,
    effective_from  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_to    TIMESTAMP       NULL,
    created_by      VARCHAR(100)    NOT NULL DEFAULT 'system',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_key_active (user_id, config_key, effective_to),
    CONSTRAINT fk_override_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Global Config Defaults ────────────────────────────────────────────────────
-- Admin can override any of these at runtime without redeployment.
INSERT INTO global_config (config_key, config_value, description) VALUES
('board_size',           '25',           'Total cells on the board (5x5 grid)'),
('min_mines',            '1',            'Minimum mines a player can select'),
('max_mines',            '24',           'Maximum mines a player can select'),
('min_bet_paise',        '100',          'Minimum bet in paise (₹1)'),
('max_bet_paise',        '1000000',      'Maximum bet in paise (₹10000)'),
('game_expiry_seconds',  '3600',         'Seconds before an idle active game expires'),
('house_edge',           '0.05',         'House edge fraction (5%)'),
('multiplier_formula',   '"ACTUARIAL"',  'Multiplier model: ACTUARIAL | CUSTOM'),
('budget_tolerance_pct', '0.05',         'Allowed budget overshoot fraction (5%)'),
('config_cache_ttl',     '300',          'Seconds to cache effective config in Redis')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- ── Default Slot Configs ──────────────────────────────────────────────────────
INSERT INTO slot_configs (slot_name, start_hour, end_hour, budget_paise, pacing_strategy) VALUES
('Night',   0,  6,  500000,  'ADAPTIVE'),
('Morning', 6,  12, 500000,  'ADAPTIVE'),
('Day',     12, 18, 500000,  'ADAPTIVE'),
('Evening', 18, 24, 500000,  'ADAPTIVE')
ON DUPLICATE KEY UPDATE slot_name = VALUES(slot_name);

-- ── Seed Players & Admin ──────────────────────────────────────────────────────
-- Passwords are bcrypt hashes of 'password123' (cost factor 10).
-- For development only. Do NOT use in production.
INSERT INTO users (username, email, password_hash, balance_paise, role, status) VALUES
('Yash',  'yash@example.com',  '$2b$10$mQXCvA.2XmmujqI/CFymYuu17Hvky3dts8cKfcCjNeg4ugZ8/ZzwW', 500000, 'PLAYER', 'ACTIVE'),
('Demo',  'demo@example.com',  '$2b$10$mQXCvA.2XmmujqI/CFymYuu17Hvky3dts8cKfcCjNeg4ugZ8/ZzwW', 100000, 'PLAYER', 'ACTIVE'),
('Admin', 'admin@stake.mine',  '$2b$10$mQXCvA.2XmmujqI/CFymYuu17Hvky3dts8cKfcCjNeg4ugZ8/ZzwW', 0,      'ADMIN',  'ACTIVE')
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  status = VALUES(status);
