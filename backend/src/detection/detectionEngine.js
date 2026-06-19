'use strict';

const detectionConfig = require('../config/detectionConfig');
const StrategyFactory = require('./strategyFactory');
const alertService = require('../services/alertService');
const logger = require('../utils/logger');

/**
 * DetectionEngine orchestrates stock anomaly detection.
 * 
 * ### Replay-Burst Handling Explanation:
 * When historical stock data is "replayed" in a burst (e.g., hundreds of ticks sent
 * within a few milliseconds), using real-world time (Date.now()) would cause severe issues:
 * 1. Rolling windows (e.g., 30s) would expire immediately in real-world milliseconds, meaning
 *    we would compare ticks separated by hours of simulated time as if they occurred in the same second.
 * 2. Cooldown windows (e.g., 60s) would block almost all alerts because many simulated minutes of
 *    ticks would pass in a single real-world second.
 * 
 * To handle replay bursts correctly and deterministically:
 * - We NEVER use real-world time (Date.now()) in detection and cooldown logic.
 * - All rolling window strategies use the simulated timestamp (`TS` or `tick.TS`) provided by the tick itself.
 * - The cooldown duration is tracked against the simulated timestamp (`tick.TS` or `currentTS`).
 * - Expired ticks are removed from windows relative to the timestamp of the incoming tick.
 * This guarantees correct anomaly detection regardless of how fast or slow the ticks are replayed.
 */
class DetectionEngine {
  constructor() {
    this.strategies = new Map(); // symbol -> strategyInstance
    this.initializeStrategies();
  }

  /**
   * Instantiate strategies for configured symbols.
   */
  initializeStrategies() {
    const symbolConfigs = detectionConfig.symbols;
    for (const [symbol, config] of Object.entries(symbolConfigs)) {
      try {
        const strategyInstance = StrategyFactory.create(config.strategy, config);
        this.strategies.set(symbol.toUpperCase(), strategyInstance);
        logger.info(`Initialized ${config.strategy} strategy for ${symbol}`);
      } catch (err) {
        logger.error(`Failed to initialize strategy for ${symbol}`, { error: err.message });
      }
    }
  }

  /**
   * Process a single incoming tick.
   * @param {Object} tick
   */
  processTick(tick) {
    if (!tick) {
      return;
    }

    const symbol = (tick.SYMBOL || tick.symbol || '').toUpperCase();
    const rawTS = tick.TS || tick.timestamp;

    if (!symbol || !rawTS) {
      return;
    }

    let strategy = this.strategies.get(symbol);

    if (!strategy) {
      // Enable dynamic strategy creation for virtual symbols in load testing
      const baseSymbol = symbol.split('-')[0];
      const baseConfig = detectionConfig.symbols[baseSymbol] || detectionConfig.defaults;
      if (baseConfig && symbol !== baseSymbol) {
        try {
          const strategyType = baseConfig.strategy || 'spike';
          const strategyInstance = StrategyFactory.create(strategyType, baseConfig);
          this.strategies.set(symbol, strategyInstance);
          strategy = strategyInstance;
          logger.debug(`Dynamically initialized ${strategyType} strategy for virtual symbol ${symbol}`);
        } catch (err) {
          logger.error(`Failed to dynamically initialize strategy for ${symbol}`, { error: err.message });
          return;
        }
      } else {
        return; // No detection strategy configured for this symbol
      }
    }

    try {
      const alertPayload = strategy.process(tick);
      if (alertPayload) {
        // Generate and broadcast alert
        alertService.createAlert({
          symbol: symbol,
          type: alertPayload.type,
          description: alertPayload.description,
          value: alertPayload.value,
          threshold: alertPayload.threshold,
          timestamp: new Date(rawTS).getTime(), // Ensure alert uses simulated tick timestamp in ms
          details: alertPayload.details
        });
      }
    } catch (err) {
      logger.error(`Error processing tick in strategy for ${symbol}`, { error: err.message, tick });
    }
  }

  /**
   * Reset engine states (mainly for test cleanup)
   */
  reset() {
    for (const strategy of this.strategies.values()) {
      strategy.reset();
    }
  }
}

module.exports = new DetectionEngine();
