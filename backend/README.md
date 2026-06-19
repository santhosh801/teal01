# TealVue Stock Anomaly Detection Backend

Backend service that connects to the TealVue Mock Market Socket.IO feed, subscribes to stock symbols, ingests live tick data, and prepares a scalable architecture for anomaly detection.

## Tech Stack
* Node.js (>= 18.x)
* Express.js
* Socket.IO Client (for consuming upstream market feed)
* Socket.IO Server (for emitting downstream alerts)
* Helmet & CORS
* Express Rate Limit
* UUID
* Winston Logger
* dotenv

---

## Folder Structure
```
backend/
├── src/
│   ├── config/          # Environment configuration loading
│   ├── services/        # Feed client, Alert service
│   ├── state/           # Symbol state storage manager
│   ├── routes/          # API endpoint routes
│   ├── middleware/      # Authentication & global middleware
│   ├── utils/           # Logger utilities
│   ├── app.js           # Express app setup
│   └── server.js        # Server execution entry point
├── .env                 # Environment variables
├── package.json         # Scripts and dependencies
└── README.md            # Setup and operations guide
```

---

## Setup & Running Instructions

### 1. Install Dependencies
Run from the `backend/` directory:
```bash
npm install
```

### 2. Configure Environment Variables
Create or adjust the `.env` file in the root of the `backend/` folder:
```ini
PORT=4000
API_KEY=tealvue-super-secret-api-key-change-me
FEED_URL=https://mock-data.tealvue.in
SYMBOLS=RELIANCE,TCS
MAX_TICKS_PER_SYMBOL=500
MAX_ALERTS=100
```

### 3. Start the Server
- **Development Mode** (with automatic reload using nodemon):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

---

## Core API Endpoints

### 1. Health Status
Verify the server status.
* **URL**: `GET /health`
* **Auth**: None
* **Response**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-06-17T10:45:00.000Z",
    "uptime": 23.45
  }
  ```

### 2. Get Alerts
Retrieve the latest stock anomaly alerts.
* **URL**: `GET /api/alerts`
* **Auth**: Required API Key via Header `X-API-KEY` or Query Parameter `apiKey`
* **Query Parameter**: `limit` (Optional, defaults to 10, max 100)
* **Headers**: `X-API-KEY: tealvue-super-secret-api-key-change-me`
* **Response**:
  ```json
  {
    "success": true,
    "count": 1,
    "alerts": [
      {
        "alertRef": "TV-7cde4b83-a261-4df2-8c85-b1a72d733c70",
        "timestamp": 1781779200000,
        "symbol": "RELIANCE",
        "type": "BOOTSTRAP",
        "description": "TealVue Backend System online. Connection to stock data feed initialized.",
        "value": 0,
        "threshold": 0
      }
    ]
  }
  ```

### 3. Tracked Symbols State
View state details of ingested tickers.
* **URL**: `GET /api/symbols`
* **Auth**: Required API Key
* **Response**:
  ```json
  {
    "success": true,
    "data": {
      "RELIANCE": {
        "latestTick": {
          "price": 2450.25,
          "timestamp": 1781779201000,
          "symbol": "RELIANCE"
        },
        "tickCount": 142
      },
      "TCS": {
        "latestTick": {
          "price": 3820.10,
          "timestamp": 1781779201050,
          "symbol": "TCS"
        },
        "tickCount": 98
      }
    }
  }
  ```

---

## Downstream Socket.IO Server
Downstream clients can connect directly to the Express server port (e.g. `http://localhost:4000`) via Socket.IO:
* **Connection**: Transmits `initial_alerts` event containing current cached alerts.
* **Real-time Alert Broadcasts**: Emits `new_alert` event containing alert payload when a new alert is generated.
