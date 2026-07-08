/**
 * response.helper.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Utility helpers for building consistent API response shapes.
 *
 * Usage:
 *   const { success, error } = require('../utils/response.helper');
 *   res.status(200).json(success(data, 'Fetched successfully'));
 *   res.status(400).json(error('Validation failed'));
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * Build a successful response envelope.
 * @param {*}      data
 * @param {string} [message]
 * @returns {{ success: true, message?: string, data: * }}
 */
const success = (data, message) => ({
  success: true,
  ...(message && { message }),
  data,
});

/**
 * Build an error response envelope.
 * @param {string} message
 * @param {*}      [details]
 * @returns {{ success: false, message: string, details?: * }}
 */
const error = (message, details) => ({
  success: false,
  message,
  ...(details && { details }),
});

module.exports = { success, error };
