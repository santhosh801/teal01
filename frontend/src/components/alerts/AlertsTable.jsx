import { useState, useEffect, useCallback } from 'react';
import { fetchAlerts } from '../../services/api';

const TYPE_LABELS = {
  SPIKE: { label: 'SPIKE', cls: 'tag--spike' },
  MOVING_AVERAGE_DEVIATION: { label: 'MA DEV', cls: 'tag--ma' },
  BOOTSTRAP: { label: 'SYSTEM', cls: 'tag--bootstrap' },
};

function getTypeInfo(type) {
  return TYPE_LABELS[type] || { label: type, cls: 'tag--other' };
}

function formatTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AlertsTable() {
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastRefresh, setLast]  = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAlerts(50);
      setAlerts(data);
      setLast(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial load */
  useEffect(() => { load(); }, [load]);

  /* Auto-refresh every 30 s */
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="alerts-table glass">
      <div className="alerts-table__header">
        <span className="alerts-table__title">Recent Alerts</span>
        <div className="alerts-table__meta">
          {lastRefresh && (
            <span className="alerts-table__refresh-time">
              Refreshed {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button className="alerts-table__btn" onClick={load} disabled={loading}>
            {loading ? '⟳ Loading…' : '⟳ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alerts-table__error">⚠ {error}</div>
      )}

      <div className="alerts-table__scroll">
        <table className="alerts-table__table">
          <thead>
            <tr>
              <th>Alert Ref</th>
              <th>Symbol</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading && alerts.length === 0 ? (
              <tr><td colSpan="5" className="alerts-table__loading">Loading…</td></tr>
            ) : alerts.length === 0 ? (
              <tr><td colSpan="5" className="alerts-table__empty">No alerts yet.</td></tr>
            ) : (
              alerts.map((a) => {
                const { label, cls } = getTypeInfo(a.type);
                return (
                  <tr key={a.alertRef} className="alerts-table__row">
                    <td className="alerts-table__ref">{a.alertRef}</td>
                    <td><strong style={{ color: '#00d4ff' }}>{a.symbol}</strong></td>
                    <td><span className={`tag ${cls}`}>{label}</span></td>
                    <td className="alerts-table__reason">{a.description}</td>
                    <td className="alerts-table__ts">{formatTs(a.timestamp)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
