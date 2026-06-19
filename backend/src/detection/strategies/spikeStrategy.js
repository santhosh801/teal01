'use strict';

const BaseStrategy = require('./baseStrategy');

class SpikeStrategy extends BaseStrategy {
  constructor(config) {
    super(config);
    this.thresholdPercent = config.thresholdPercent;
    this.windowMs = config.windowSec * 1000;
    this.ticksWindow = []; // Stores rolling { price, TS }
  }

  process(tick) {
    const price = Number(tick.price !== undefined ? tick.price : tick.LTP);
    const rawTS = tick.TS || tick.timestamp;
    
    if (isNaN(price) || !rawTS) {
      return null;
    }

    const currentTS = new Date(rawTS).getTime();
    if (isNaN(currentTS)) {
      return null;
    }

    // 1. Add current tick to window
    this.ticksWindow.push({ price, TS: currentTS });

    // 2. Remove expired entries immediately (ticks older than currentTS - windowMs)
    const expiryTime = currentTS - this.windowMs;
    while (this.ticksWindow.length > 0 && this.ticksWindow[0].TS < expiryTime) {
      this.ticksWindow.shift();
    }

    // Must have at least 2 ticks to compute a price difference
    if (this.ticksWindow.length < 2) {
      return null;
    }

    // 3. Compare current price against the oldest price still inside the window
    const basePrice = this.ticksWindow[0].price;
    if (basePrice === 0) {
      return null; // Avoid division by zero
    }

    const percentChange = ((price - basePrice) / basePrice) * 100;

    if (Math.abs(percentChange) >= this.thresholdPercent) {
      // Check cooldown
      if (this.checkCooldown(currentTS)) {
        this.lastAlertTS = currentTS;
        const direction = percentChange > 0 ? 'increased' : 'decreased';
        return {
          type: 'SPIKE',
          description: `Price ${direction} ${Math.abs(percentChange).toFixed(1)}% within ${this.config.windowSec} simulated seconds`,
          value: price,
          threshold: this.thresholdPercent,
          details: {
            basePrice,
            currentPrice: price,
            percentChange: Number(percentChange.toFixed(4)),
          }
        };
      }
    }

    return null;
  }

  reset() {
    super.reset();
    this.ticksWindow = [];
  }
}

module.exports = SpikeStrategy;
