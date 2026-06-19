const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware to validate API Key authentication.
 */
const authenticateApiKey = (req, res, next) => {
  const apiKeyHeader = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKeyHeader) {
    logger.warn('Authentication failed: Missing X-API-KEY header or apiKey query parameter', {
      ip: req.ip,
      path: req.originalUrl
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API Key is missing. Provide it in X-API-KEY header or apiKey query param.'
    });
  }

  if (apiKeyHeader !== config.security.apiKey) {
    logger.warn('Authentication failed: Invalid API Key provided', {
      ip: req.ip,
      path: req.originalUrl
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API Key.'
    });
  }

  next();
};

module.exports = {
  authenticateApiKey
};
