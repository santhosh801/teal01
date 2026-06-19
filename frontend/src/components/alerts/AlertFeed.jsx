import { useState, useEffect, useRef } from 'react';
import { subscribe } from '../../services/socket';

const MAX_FEED_ALERTS = 50;

const TYPE_LABELS = {
  SPIKE: { label: 'SPIKE', cls: 'tag--spike' },
  MOVING_AVERAGE_DEVIATION: { label: 'MA DEV', cls: 'tag--ma' },
  BOOTSTRAP: { label: 'SYSTEM', cls: 'tag--bootstrap' },
};

function getTypeInfo(type) {
  return TYPE_LABELS[type] || { label: type, cls: 'tag--other' };
}

function formatSimTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function AlertItem({ alert, isNew }) {
  const { label, cls } = getTypeInfo(alert.type);
  return (
    <div className={`alert-item glass ${isNew ? 'alert-item--new' : ''}`} style={{
      borderLeft: alert.type === 'SPIKE'
        ? '3px solid #ef4444'
        : alert.type === 'MOVING_AVERAGE_DEVIATION'
        ? '3px solid #8b5cf6'
        : '3px solid #10b981',
    }}>
      <div className="alert-item__top">
        <span className="alert-item__ref">{alert.alertRef}</span>
        <span className={`tag ${cls}`}>{label}</span>
      </div>
      <div className="alert-item__symbol">{alert.symbol}</div>
      <div className="alert-item__reason">{alert.description}</div>
      <div className="alert-item__time">{formatSimTime(alert.timestamp)}</div>
    </div>
  );
}

export default function AlertFeed() {
  const [alerts, setAlerts] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const feedRef = useRef(null);

  /* Seed initial alerts from backend on connect */
  useEffect(() => {
    const unsub = subscribe('initial_alerts', (data) => {
      if (Array.isArray(data)) {
        setAlerts(data.slice(0, MAX_FEED_ALERTS));
      }
    });
    return unsub;
  }, []);

  /* Listen for real-time new alerts */
  useEffect(() => {
    const unsub = subscribe('new_alert', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, MAX_FEED_ALERTS));
      setNewIds((prev) => new Set([...prev, alert.alertRef]));
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(alert.alertRef);
          return next;
        });
      }, 3000);
    });
    return unsub;
  }, []);

  /* Auto-scroll to top on new alert */
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, [alerts.length]);

  return (
    <div className="alert-feed glass">
      <div className="alert-feed__header">
        <span className="alert-feed__title">
          <span className="blink" style={{ color: '#ef4444', marginRight: 6 }}>●</span>
          Live Alert Feed
        </span>
        <span className="alert-feed__count">{alerts.length} alerts</span>
      </div>
      <div className="alert-feed__list" ref={feedRef}>
        {alerts.length === 0 ? (
          <div className="alert-feed__empty">Waiting for anomaly alerts…</div>
        ) : (
          alerts.map((a) => (
            <AlertItem key={a.alertRef} alert={a} isNew={newIds.has(a.alertRef)} />
          ))
        )}
      </div>
    </div>
  );
}
