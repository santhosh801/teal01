'use strict';

require('dotenv').config();

/**
 * Central configuration object.
 * All environment variables are resolved here so the rest of the codebase
 * never touches process.env directly.
 */
const config = {
  server: {
    port: parseInt(process.env.PORT, 10) || 4000,
  },

  security: {
    apiKey: process.env.API_KEY || 'trackz-assignment-key',
  },

  feed: {
    url: process.env.FEED_URL || 'https://mock-data.tealvue.in',
    symbols: (process.env.SYMBOLS || 'RELIANCE,TCS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  state: {
    maxTicksPerSymbol: parseInt(process.env.MAX_TICKS_PER_SYMBOL, 10) || 500,
  },

  alerts: {
    maxAlerts: parseInt(process.env.MAX_ALERTS, 10) || 100,
    latestCount: 10,
    refPrefix: 'TV-',
  },

  rateLimit: {
    windowMs: 60 * 1000,   // 1 minute
    max: 100,              // requests per window (updated to 100/min/IP)
  },
};

module.exports = config;
