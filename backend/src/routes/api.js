const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');
const symbolState = require('../state/symbolState');
const logger = require('../utils/logger');

/**
 * GET /api/alerts
 * Retrieve the latest stock anomaly alerts.
 * Supports a query parameter `limit` to control number of alerts returned (max 100).
 */
router.get('/alerts', (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit <= 0) {
      limit = 10; // default to 10 as per requirement
    }
    // Limit to safety bounds
    limit = Math.min(limit, 100);

    const latestAlerts = alertService.getLatestAlerts(limit);
    return res.status(200).json({
      success: true,
      count: latestAlerts.length,
      alerts: latestAlerts
    });
  } catch (error) {
    logger.error('Error fetching alerts', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts.'
    });
  }
});

/**
 * GET /api/symbols
 * Helper endpoint to retrieve tracked symbols and their latest tick.
 */
router.get('/symbols', (req, res) => {
  try {
    const symbols = symbolState.getSymbols();
    const result = symbols.reduce((acc, sym) => {
      acc[sym] = {
        latestTick: symbolState.getLatestTick(sym),
        tickCount: symbolState.getTicks(sym).length
      };
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching symbols state', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve symbol status.'
    });
  }
});

module.exports = router;
