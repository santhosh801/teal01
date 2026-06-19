import { useState, useEffect } from 'react';
import { subscribe } from '../../services/socket';
import { fetchSymbols } from '../../services/api';

const SYMBOLS = ['RELIANCE', 'TCS'];

export function SymbolCard({ symbol, price, prevPrice, timestamp, initialPrice }) {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  // Determine direction class for price text flash color
  let dirClass = '';
  if (price > prevPrice) {
    dirClass = 'up';
  } else if (price < prevPrice) {
    dirClass = 'down';
  }

  // Calculate session change percent
  const displayPrice = price !== undefined ? price : 0;
  const refPrice = initialPrice || prevPrice || displayPrice;
  const changePercent = refPrice > 0 ? ((displayPrice - refPrice) / refPrice) * 100 : 0;
  const changeSign = changePercent > 0 ? '+' : '';

  return (
    <div className="symbol-card glass">
      <div className="symbol-card__header">
        <span className="symbol-card__symbol">{symbol}</span>
        <span className={`symbol-card__dot ${price ? 'symbol-card__dot--live' : ''}`} />
      </div>
      <div className={`symbol-card__price ${dirClass ? `symbol-card__price--${dirClass}` : ''}`}>
        ₹{displayPrice.toFixed(2)}
      </div>
      <div className="symbol-card__footer">
        <span className={`symbol-card__change ${changePercent > 0 ? 'symbol-card__change--up' : changePercent < 0 ? 'symbol-card__change--down' : ''}`}>
          {changeSign}{changePercent.toFixed(2)}%
        </span>
        <span className="symbol-card__time">{formattedTime}</span>
      </div>
    </div>
  );
}

export default function SymbolCards() {
  const [data, setData] = useState({
    RELIANCE: { price: 0, prevPrice: 0, timestamp: null, initialPrice: 0 },
    TCS: { price: 0, prevPrice: 0, timestamp: null, initialPrice: 0 },
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1. Fetch initial states from API on component mount
    async function loadInitial() {
      try {
        const symbolsData = await fetchSymbols();
        setData((prev) => {
          const updated = { ...prev };
          Object.keys(symbolsData).forEach((sym) => {
            const symbolUpper = sym.toUpperCase();
            if (updated[symbolUpper]) {
              const tick = symbolsData[sym].latestTick;
              if (tick) {
                updated[symbolUpper] = {
                  price: tick.price,
                  prevPrice: tick.price,
                  timestamp: tick.TS || tick.timestamp,
                  initialPrice: tick.price,
                };
              }
            }
          });
          return updated;
        });
      } catch (err) {
        console.error('Failed to fetch initial symbol states:', err);
        setError('Failed to load initial price data');
      }
    }

    loadInitial();

    // 2. Subscribe to price updates via socket
    const unsub = subscribe('price_update', (tick) => {
      const symbolUpper = (tick.symbol || tick.SYMBOL || '').toUpperCase();
      if (!SYMBOLS.includes(symbolUpper)) return;

      setData((prev) => {
        const current = prev[symbolUpper];
        const nextPrice = Number(tick.price);
        const nextTimestamp = tick.TS || tick.timestamp;

        return {
          ...prev,
          [symbolUpper]: {
            price: nextPrice,
            prevPrice: current.price > 0 ? current.price : nextPrice,
            timestamp: nextTimestamp,
            initialPrice: current.initialPrice > 0 ? current.initialPrice : nextPrice,
          },
        };
      });
    });

    return unsub;
  }, []);

  return (
    <div className="symbol-cards">
      {error && <div className="symbol-cards__error" style={{ color: '#ef4444', fontSize: '12px' }}>{error}</div>}
      {SYMBOLS.map((symbol) => {
        const item = data[symbol];
        return (
          <SymbolCard
            key={symbol}
            symbol={symbol}
            price={item.price}
            prevPrice={item.prevPrice}
            timestamp={item.timestamp}
            initialPrice={item.initialPrice}
          />
        );
      })}
    </div>
  );
}
