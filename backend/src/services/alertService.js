const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');

class AlertService {
  constructor() {
    this.alerts = []; // Array of alerts
    this.maxAlerts = config.alerts.maxAlerts;
    this.prefix = config.alerts.refPrefix;
  }

  /**
   * Create and store a new alert.
   * @param {Object} alertData - Properties like symbol, type, description, value, threshold
   */
  createAlert(alertData) {
    const alert = {
      alertRef: `${this.prefix}${uuidv4()}`,
      timestamp: alertData.timestamp || Date.now(),
      symbol: alertData.symbol ? alertData.symbol.toUpperCase() : 'UNKNOWN',
      type: alertData.type || 'ANOMALY',
      description: alertData.description || 'Stock price anomaly detected',
      value: alertData.value,
      threshold: alertData.threshold,
      ...alertData
    };

    this.alerts.unshift(alert); // Keep newest at the beginning

    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }

    logger.info(`New alert generated: ${alert.alertRef}`, {
      symbol: alert.symbol,
      type: alert.type,
      value: alert.value
    });

    return alert;
  }

  /**
   * Get all stored alerts (up to maxAlerts).
   */
  getAlerts() {
    return this.alerts;
  }

  /**
   * Retrieve the latest N alerts (defaults to 10).
   */
  getLatestAlerts(limit = config.alerts.latestCount) {
    return this.alerts.slice(0, limit);
  }

  /**
   * Clear all alerts (mostly for testing).
   */
  clear() {
    this.alerts = [];
  }
}

// Singleton export
module.exports = new AlertService();
