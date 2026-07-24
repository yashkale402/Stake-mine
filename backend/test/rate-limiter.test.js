'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRateLimitKey,
  buildRateLimitResponse,
} = require('../src/middleware/rateLimiter');

test('buildRateLimitKey prefers the first forwarded IP', () => {
  const result = buildRateLimitKey({
    headers: {
      'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    },
    ip: '::1',
    socket: { remoteAddress: '127.0.0.1' },
  });

  assert.equal(result, '203.0.113.10');
});

test('buildRateLimitKey falls back to request IP and socket address', () => {
  const fromIp = buildRateLimitKey({
    headers: {},
    ip: '198.51.100.7',
    socket: { remoteAddress: '127.0.0.1' },
  });
  const fromSocket = buildRateLimitKey({
    headers: {},
    ip: '',
    socket: { remoteAddress: '192.0.2.25' },
  });

  assert.equal(fromIp, '198.51.100.7');
  assert.equal(fromSocket, '192.0.2.25');
});

test('buildRateLimitResponse includes retry metadata', () => {
  const resetTime = new Date(Date.now() + 30_000);
  const result = buildRateLimitResponse({
    rateLimit: { resetTime },
  });

  assert.equal(result.success, false);
  assert.equal(result.retryAt, resetTime.toISOString());
  assert.ok(result.retryAfterSeconds >= 1);
});
