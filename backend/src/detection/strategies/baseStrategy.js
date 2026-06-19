'use strict';

class BaseStrategy {
  constructor(config) {
    this.config = config;
    this.cooldownSec = config.cooldownSec || 60;
    this.lastAlertTS = 0; // Tracks last alert in simulated time (tick.TS)
  }

  /**
   * Process a new tick and check for anomalies.
   * @param {Object} tick - Tick data containing symbol, price, TS, etc.
   * @returns {Object|null} Alert details if anomaly detected and cooldown passed, else null.
   */
  process(tick) {
    throw new Error('process() must be implemented by subclass');
  }

  /**
   * Check if simulated cooldown period has elapsed since last alert.
   * @param {number} currentTS - Current tick timestamp in simulated time (ms)
   * @returns {boolean} True if cooldown has elapsed or no alert has been sent.
   */
  checkCooldown(currentTS) {
    if (this.lastAlertTS === 0) return true;
    const elapsedSec = (currentTS - this.lastAlertTS) / 1000;
    return elapsedSec >= this.cooldownSec;
  }

  /**
   * Reset cooldown and strategy internal state.
   */
  reset() {
    this.lastAlertTS = 0;
  }
}

module.exports = BaseStrategy;
