'use strict';

module.exports = {
  // Default configurations if symbol-specific config is missing
  defaults: {
    cooldownSec: 60, // 60 simulated seconds default cooldown
  },
  symbols: {
    RELIANCE: {
      strategy: 'spike',
      thresholdPercent: 0.5,   // 0.5% price change triggers alert (realistic for live mock feed)
      windowSec: 30,
      cooldownSec: 60,
    },
    TCS: {
      strategy: 'movingAverage',
      deviationPercent: 1,     // 1% deviation from MA triggers alert (realistic for live mock feed)
      sampleSize: 10,
      cooldownSec: 60,
    }
  }
};
