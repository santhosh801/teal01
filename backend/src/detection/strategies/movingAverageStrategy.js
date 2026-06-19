'use strict';

const BaseStrategy = require('./baseStrategy');

class MovingAverageStrategy extends BaseStrategy {
  constructor(config) {
    super(config);
    this.deviationPercent = config.deviationPercent;
    this.sampleSize = config.sampleSize;
    this.pricesWindow = []; // Stores prices of recent ticks
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

    // 1. Add price to sample window
    this.pricesWindow.push(price);

    // 2. Bound size
    if (this.pricesWindow.length > this.sampleSize) {
      this.pricesWindow.shift();
    }

    // Need at least a minimum sample size to calculate moving average (min 2 or configuration limit)
    const minSampleRequired = Math.min(2, this.sampleSize);
    if (this.pricesWindow.length < minSampleRequired) {
      return null;
    }

    // 3. Calculate moving average
    const sum = this.pricesWindow.reduce((acc, p) => acc + p, 0);
    const movingAverage = sum / this.pricesWindow.length;

    if (movingAverage === 0) {
      return null;
    }

    // 4. Calculate deviation
    const deviation = ((price - movingAverage) / movingAverage) * 100;

    if (Math.abs(deviation) >= this.deviationPercent) {
      if (this.checkCooldown(currentTS)) {
        this.lastAlertTS = currentTS;
        const direction = deviation > 0 ? 'above' : 'below';
        return {
          type: 'MOVING_AVERAGE_DEVIATION',
          description: `Price deviated ${Math.abs(deviation).toFixed(1)}% ${direction} the moving average of last ${this.pricesWindow.length} samples`,
          value: price,
          threshold: this.deviationPercent,
          details: {
            movingAverage: Number(movingAverage.toFixed(4)),
            currentPrice: price,
            deviation: Number(deviation.toFixed(4)),
          }
        };
      }
    }

    return null;
  }

  reset() {
    super.reset();
    this.pricesWindow = [];
  }
}

module.exports = MovingAverageStrategy;
