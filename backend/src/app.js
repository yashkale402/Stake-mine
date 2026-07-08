/**
 * app.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Express application factory.
 *
 * This file configures the Express app — middleware, routes, and error handlers.
 * It does NOT start the HTTP server; that's server.js's job.
 * Keeping them separate makes unit-testing easier (import app without binding a port).
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimiter  = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const notFound     = require('./middleware/notFound');
const healthRoutes = require('./routes/health.routes');
const apiRoutes    = require('./routes/index');

const app = express();

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());   // Sets secure HTTP response headers

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',  // Restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(rateLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());          // Parse application/json
app.use(express.urlencoded({ extended: true })); // Parse form data

// ── Request logging ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/health', healthRoutes);     // Health check (no versioning)
app.use('/api/v1', apiRoutes);        // All versioned API routes

// ── 404 handler (must be after all routes) ────────────────────────────────────
app.use(notFound);

// ── Global error handler (must be last, 4-param signature) ───────────────────
app.use(errorHandler);

module.exports = app;
