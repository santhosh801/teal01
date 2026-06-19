import { useState, useEffect } from 'react';
import { subscribe } from '../services/socket';

function ConnectionBadge() {
  const [status, setStatus] = useState({ connected: false, reason: null, error: null });

  useEffect(() => {
    const unsub = subscribe('connection_status', (data) => {
      setStatus(data);
    });
    return unsub;
  }, []);

  let badgeClass = 'conn-badge--offline';
  let badgeText = 'Disconnected';

  if (status.connected) {
    badgeClass = 'conn-badge--live';
    badgeText = 'Live';
  } else if (status.reason || status.error) {
    badgeClass = 'conn-badge--offline';
    badgeText = 'Reconnecting…';
  } else {
    badgeClass = 'conn-badge--offline';
    badgeText = 'Connecting…';
  }

  return (
    <div className={`conn-badge ${badgeClass}`}>
      <span className={`conn-badge__dot ${status.connected ? 'blink' : ''}`} />
      <span>{badgeText}</span>
    </div>
  );
}

export default function Header() {
  return (
    <header className="dashboard__header glass">
      <div className="dashboard__brand">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="#00d4ff" strokeWidth="1.5" />
          <path d="M7 18L12 11L16 15L21 8" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="dashboard__brand-name">Trackz</span>
        <span className="dashboard__brand-sub">Anomaly Detection Platform</span>
      </div>
      <ConnectionBadge />
    </header>
  );
}
