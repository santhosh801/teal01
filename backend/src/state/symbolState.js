const logger = require('../utils/logger');
const config = require('../config');

class SymbolStateManager {
  constructor() {
    this.ticks = new Map(); // symbol -> Array of tick objects
    this.maxTicks = config.state.maxTicksPerSymbol;
  }

  /**
   * Ingest tick data.
   * Expected shape: { symbol: string, price: number, timestamp: number | string, volume?: number, ... }
   */
  addTick(tick) {
    if (!tick) return;
    const symbol = (tick.symbol || tick.SYMBOL || '').toUpperCase();
    if (!symbol) {
      logger.warn('Received invalid tick object in state manager', { tick });
      return;
    }

    if (!this.ticks.has(symbol)) {
      this.ticks.set(symbol, []);
    }

    const price = Number(tick.price !== undefined ? tick.price : (tick.LTP !== undefined ? tick.LTP : 0));
    const rawTS = tick.TS || tick.timestamp;
    if (!rawTS) {
      logger.warn('Received tick without TS or timestamp in state manager', { tick });
      return;
    }
    const timestamp = new Date(rawTS).getTime();

    const symbolTicks = this.ticks.get(symbol);
    symbolTicks.push({
      symbol,
      price,
      timestamp,
      volume: tick.volume ? Number(tick.volume) : undefined
    });

    // Enforce max limit per symbol to prevent memory leaks
    if (symbolTicks.length > this.maxTicks) {
      symbolTicks.shift();
    }
  }

  /**
   * Get all cached ticks for a symbol.
   */
  getTicks(symbol) {
    return this.ticks.get(symbol.toUpperCase()) || [];
  }

  /**
   * Get latest tick for a symbol.
   */
  getLatestTick(symbol) {
    const ticks = this.getTicks(symbol);
    return ticks.length > 0 ? ticks[ticks.length - 1] : null;
  }

  /**
   * Get all managed symbols.
   */
  getSymbols() {
    return Array.from(this.ticks.keys());
  }

  /**
   * Clear all stored ticks.
   */
  clear() {
    this.ticks.clear();
  }
}

// Singleton export
module.exports = new SymbolStateManager();
