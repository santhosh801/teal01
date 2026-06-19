const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const apiRoutes = require('./routes/api');
const { authenticateApiKey } = require('./middleware/auth');
const logger = require('./utils/logger');

const app = express();

// 1. Security Middleware
app.use(helmet());

// 2. CORS configuration (allows development environments to connect)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY']
}));

// 3. JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Rate Limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.'
  }
});
app.use('/api/', limiter);

// 5. Request Logging Middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint (Public)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Diagnostic feed status endpoint (Public - for debugging)
app.get('/feed-status', (req, res) => {
  try {
    const marketFeedClient = require('./services/marketFeedClient');
    const symbolState = require('./state/symbolState');
    res.status(200).json({
      feed: marketFeedClient.getStatus(),
      symbols: symbolState.getSymbols(),
      tickCounts: symbolState.getSymbols().reduce((acc, s) => {
        acc[s] = symbolState.getTicks(s).length;
        return acc;
      }, {}),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Secure API Routes
app.use('/api', authenticateApiKey, apiRoutes);

// 7. 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// 8. Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled server error', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred on the server.'
  });
});

module.exports = app;
