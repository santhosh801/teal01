import { useState, useEffect } from 'react';
import { subscribe } from '../services/socket';
import SymbolCards from '../components/cards/SymbolCard';
import SymbolChart from '../components/charts/SymbolChart';
import AlertFeed from '../components/alerts/AlertFeed';
import AlertsTable from '../components/alerts/AlertsTable';
import Header from '../components/Header';

const SYMBOLS = ['RELIANCE', 'TCS'];

export default function Dashboard() {
  return (
    <div className="dashboard">
      {/* ── Header ───────────────────────────────────────── */}
      <Header />

      <div className="dashboard__content">
        {/* ── Left Column ─────────────────────────────────── */}
        <div className="dashboard__left">
          <section className="dashboard__section-compact">
            <h2 className="dashboard__section-title">Live Market Prices</h2>
            <SymbolCards />
          </section>

          <section className="dashboard__section-compact dashboard__charts-section">
            <h2 className="dashboard__section-title">Price Charts</h2>
            <div className="charts-grid">
              {SYMBOLS.map((s) => <SymbolChart key={s} symbol={s} />)}
            </div>
          </section>
        </div>

        {/* ── Right Column ────────────────────────────────── */}
        <div className="dashboard__right">
          <section className="dashboard__section-compact dashboard__feed-section">
            <h2 className="dashboard__section-title">
              <span className="blink" style={{ color: '#ef4444', marginRight: 6 }}>●</span>
              Alert Feed
            </h2>
            <AlertFeed />
          </section>

          <section className="dashboard__section-compact dashboard__table-section">
            <h2 className="dashboard__section-title">Recent Alerts History</h2>
            <AlertsTable />
          </section>
        </div>
      </div>

      <footer className="dashboard__footer">
        <span>Trackz Anomaly Detection Platform</span>
        <span style={{ color: 'var(--text-muted)' }}>All times are simulated market time (TS)</span>
      </footer>
    </div>
  );
}
