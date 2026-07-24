/**
 * config.service.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Loads the effective configuration for a player.
 *
 * Inheritance model:
 *   GlobalConfig → PlayerOverrides → EffectiveConfig
 *
 * Every player inherits the global config by default.
 * Any player override with a matching key replaces the global value.
 *
 * Cache strategy (Read-Through):
 *   1. Check Redis (TTL = 300s by default).
 *   2. On miss → build from MySQL → cache → return.
 *   3. On admin config change → invalidate Redis key via cache.repository.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const configRepository = require('../repositories/config.repository');
const cacheRepository  = require('../repositories/cache.repository');
const logger           = require('../logger/logger');

/**
 * Load the merged effective configuration for a player.
 * Applies player overrides on top of global defaults.
 *
 * @param {number} userId
 * @returns {Promise<Object>} Effective config (plain object, all values parsed)
 */
async function loadEffectiveConfig(userId) {
  // ── 1. Check Redis ───────────────────────────────────────────────────────
  const cached = await cacheRepository.getEffectiveConfig(userId);
  if (cached) {
    logger.debug(`[Config] Cache HIT for user ${userId}`);
    return cached;
  }

  logger.debug(`[Config] Cache MISS for user ${userId} — loading from MySQL`);

  // ── 2. Load global config from MySQL ────────────────────────────────────
  const globalRows = await configRepository.getAllGlobalConfig();
  const config = {};

  for (const row of globalRows) {
    // config_value is stored as JSON in MySQL — parse it
    try {
      config[row.config_key] = typeof row.config_value === 'string'
        ? JSON.parse(row.config_value)
        : row.config_value;
    } catch {
      config[row.config_key] = row.config_value;
    }
  }

  // ── 3. Apply player overrides on top ────────────────────────────────────
  const overrides = await configRepository.getActivePlayerOverrides(userId);
  for (const override of overrides) {
    try {
      config[override.config_key] = typeof override.config_value === 'string'
        ? JSON.parse(override.config_value)
        : override.config_value;
    } catch {
      config[override.config_key] = override.config_value;
    }
    logger.debug(`[Config] Override applied for user ${userId}: ${override.config_key}`);
  }

  // ── 4. Cache the merged config ───────────────────────────────────────────
  const cacheTtl = config.config_cache_ttl || 300;
  await cacheRepository.setEffectiveConfig(userId, config, cacheTtl);

  return config;
}

/**
 * Update a global config value. Invalidates all config caches.
 *
 * @param {string} key
 * @param {any}    value
 * @param {string} updatedBy
 */
async function setGlobalConfig(key, value, updatedBy) {
  await configRepository.setGlobalConfig(key, value, updatedBy);
  await configRepository.insertAuditLog({
    entity_type: 'CONFIG',
    entity_id: key,
    action: 'CONFIG_UPDATE',
    actor: updatedBy,
    payload: { key, value },
  });
  // Invalidate all player config caches so changes take effect on next request
  await cacheRepository.invalidateEffectiveConfig('global');
  logger.info(`[Config] Global config updated: ${key} = ${JSON.stringify(value)} by ${updatedBy}`);
}

/**
 * Get all global config (for admin dashboard).
 * @returns {Promise<Array>}
 */
async function getAllGlobalConfig() {
  return configRepository.getAllGlobalConfig();
}

module.exports = { loadEffectiveConfig, setGlobalConfig, getAllGlobalConfig };
