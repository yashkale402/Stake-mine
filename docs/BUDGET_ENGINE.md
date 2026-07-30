# Budget & Risk Engine — Design Summary

Overview
--------
This document describes the newly added modular Budget & Quote engine that integrates with the existing game flow while preserving all existing APIs and behaviour.

New MySQL tables
-----------------
- `budget_reservations` — per-game reservation rows (reservation_uuid, game_uuid, user_id, slot_ledger_id, reserved_paise, status).
- `budget_history` — auditable history of reservations, settlements, releases, recoveries.

Redis keys
----------
The system reuses existing Redis budget caching in `cache.repository`:
- `budget:slot:{slotId}:{YYYY-MM-DD}` — JSON cache of ledger state (total, spent, gameCount).

New backend modules
-------------------
- `backend/src/repositories/budget.repository.js` — DB operations for reservations & history.
- `backend/src/services/budget.service.js` — reserve/release/settle helpers; creates history rows.
- `backend/src/services/quote-engine.service.js` — conservative payout quoting (not used synchronously to avoid circular deps).
- `backend/src/services/player-profile.service.js` — lightweight player profile heuristics.

Integration points
------------------
- Reservation at start: `game.repository.createGame(...)` now computes a conservative reservation inside the same DB transaction and calls `budget.service.reserveBudgetForGame(...)`. If reservation fails, the transaction aborts and the Start Game request is rejected.
- Settlement on cashout: `game.repository.settleGameCashout(...)` calls `budget.service.settleReservationOnCashout(...)` in the same transaction so reservations are marked SETTLED and budget history is recorded.
- Release on loss: `game.repository.settleGameLost(...)` calls `budget.service.releaseReservationOnLoss(...)` to mark the reservation RELEASED and insert a release history record.

Quote behaviour
--------------
- The quote engine is conservative by default: it computes `maxAllowedPayout = min(bet * configured_max_multiplier, remaining_budget * 0.9, maximum_exposure)` and returns a `riskLevel` based on remaining budget %.
- Player profile adjustments and richer quoting logic are implemented in `quote-engine.service.js` but the reservation performed at game start uses a conservative estimate (via `global_config.maximum_multiplier`) to avoid circular dependency with repositories.

Runtime config
--------------
Runtime configuration values remain in `global_config` and can be modified via the existing admin endpoints (`/api/v1/admin/config`). New expected keys (optional) include:
- `maximum_multiplier` (number)
- `maximum_exposure_paise` (integer)
- `rtp_target` (fraction)
- `emergency_threshold_pct` (fraction)

Sequence summary
----------------
1. Start Game request arrives.
2. Existing validation and risk logic runs.
3. Inside the DB transaction that creates the `game_sessions` row, the repository computes a conservative reservation amount and inserts a `budget_reservations` row.
4. Transaction commits: game row created and reservation active; Redis cache is populated as before.
5. On Cashout, game settlement updates `game_sessions` and the repository marks the reservation SETTLED and appends `budget_history` record; `slot_budget_ledger.spent_paise` is incremented in the existing flow.
6. On Loss, the repository marks the reservation RELEASED and the reserved amount returns to available pool; a `budget_history` record with type `RELEASE` is appended.

Notes & backward compatibility
--------------------------------
- No existing public APIs were changed.
- `game.service.js` logic was not rewritten; integration is implemented inside repository settle/create operations to ensure atomic changes inside DB transactions.
- Redis caching strategy and MySQL remain the source of truth.
