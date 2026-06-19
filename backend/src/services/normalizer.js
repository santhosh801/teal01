'use strict';

/**
 * Normalizes tick data from the raw market feed format to the standard Trackz format.
 *
 * The upstream Trackz mock feed sends ticks with these fields:
 *   ID, SYMBOL, INSTRUMENT, LOTSIZE, TS, LTQ, ATP, TTQ,
 *   OPEN, HIGH, LOW, CLOSE, PREV_CLOSE, PREV_VOLUME,
 *   TURNOVER, PRICE_DIFF, VOLUME_DIFF, VWAP
 *
 * Notably there is NO "LTP" or "price" field — the last traded price is in "CLOSE".
 *
 * @param {Object} rawTick - Raw ticker data
 * @returns {Object|null} Normalized tick containing symbol, price, and TS (simulated timestamp)
 */
function normalizeTick(rawTick) {
  if (!rawTick) return null;
  
  const symbol = (rawTick.SYMBOL || rawTick.symbol || '').toUpperCase();
  if (!symbol) return null;

  // Price extraction priority:
  // 1. CLOSE — last traded price in the upstream Trackz feed
  // 2. LTP — in case the feed format changes
  // 3. ATP — average traded price (fallback)
  // 4. price — generic fallback
  let price = rawTick.CLOSE !== undefined ? rawTick.CLOSE
            : rawTick.LTP   !== undefined ? rawTick.LTP
            : rawTick.ATP   !== undefined ? rawTick.ATP
            : rawTick.price;
  price = Number(price);
  if (isNaN(price)) return null;

  // TS is the simulated timestamp from the feed, fallback to timestamp.
  // The upstream server emits TS as 'YYYY-MM-DD HH:mm:ss+05:30' (space, not T).
  // Convert the space to 'T' to make it a valid ISO 8601 string so Date.parse()
  // returns a correct epoch value instead of NaN.
  let TS = rawTick.TS || rawTick.timestamp;
  if (!TS) return null;
  if (typeof TS === 'string') {
    // '2026-06-18 09:15:00+05:30'  →  '2026-06-18T09:15:00+05:30'
    TS = TS.replace(' ', 'T');
  }

  return {
    symbol,
    price,
    TS,
    // Pass through extra fields for richer detection/display
    open: rawTick.OPEN !== undefined ? Number(rawTick.OPEN) : undefined,
    high: rawTick.HIGH !== undefined ? Number(rawTick.HIGH) : undefined,
    low:  rawTick.LOW  !== undefined ? Number(rawTick.LOW)  : undefined,
    volume: rawTick.TTQ !== undefined ? Number(rawTick.TTQ) : undefined,
    vwap: rawTick.VWAP !== undefined ? Number(rawTick.VWAP) : undefined,
  };
}

module.exports = {
  normalizeTick
};

