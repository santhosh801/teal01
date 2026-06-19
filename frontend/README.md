# TealVue Dashboard — Frontend

React + Vite real-time fintech dashboard connecting to the TealVue backend.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Dashboard opens at: http://localhost:3000

## Prerequisites

- Backend must be running at port 4000 (`cd backend && npm run dev`)

## Features

- Live price cards (RELIANCE, TCS) with directional flash
- TradingView Lightweight Charts — incremental updates only
- Real-time alert feed via Socket.IO `new_alert` events
- Alerts history table from REST API (30s auto-refresh)
- Connection status badge with auto-reconnect

## Environment

Copy `.env` and set:
```
VITE_API_KEY=<your-api-key>
VITE_BACKEND_URL=http://localhost:4000
```
