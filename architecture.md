# Trackz Anomaly Detection Platform — Architecture Reference

This document provides a deep-dive analysis of the Trackz platform architecture, component relationships, data flow models, and design patterns.

---

## 🏗️ High-Level System Architecture

Trackz uses an event-driven, micro-service style decoupling between the ingestion layer, detection engine, alert pipeline, and client distribution layer. 

```mermaid
flowchart TB
    subgraph UpstreamMockFeed [Upstream Feed Environment]
        UPSTREAM[Mock Feed Server: Socket.IO]
    end

    subgraph BackendApp [Trackz Backend Application]
        FEED_CLIENT[Market Feed Client]
        NORMALIZER[Tick Normalization Service]
        STATE_MGR[Symbol State Manager]
        DET_ENGINE[Detection Engine]
        FACTORY[Strategy Factory]
        STRAT_SPIKE[Spike Strategy Instance]
        STRAT_MA[Moving Average Strategy Instance]
        ALERT_SVC[Alert Service]
        EVENT_BUS[Event Bus: EventEmitter]
        EXPRESS_APP[Express REST API / HTTP Server]
        SOCKET_IO[Socket.IO Server]
    end

    subgraph ClientDashboard [Frontend Application]
        VITE_APP[React Dashboard]
        SOCKET_CLIENT[Socket.IO Client]
        HTTP_CLIENT[Axios API Client]
    end

    %% Ingestion path
    UPSTREAM -->|1. Raw Ticks| FEED_CLIENT
    FEED_CLIENT -->|2. Normalize| NORMALIZER
    
    %% Distribution to State & Engine
    NORMALIZER -->|3. Standard Tick| STATE_MGR
    NORMALIZER -->|3. Standard Tick| DET_ENGINE
    NORMALIZER -->|3. Emit price_update| EVENT_BUS

    %% Strategy processing
    DET_ENGINE -->|4. Get or Create| FACTORY
    FACTORY --> STRAT_SPIKE
    FACTORY --> STRAT_MA
    DET_ENGINE -->|5. Process Tick| STRAT_SPIKE
    DET_ENGINE -->|5. Process Tick| STRAT_MA
    
    %% Alert generation
    STRAT_SPIKE -->|6. Trigger Anomaly| ALERT_SVC
    STRAT_MA -->|6. Trigger Anomaly| ALERT_SVC
    ALERT_SVC -->|7. Emit new_alert| EVENT_BUS
    ALERT_SVC -->|7. Save alert| ALERT_SVC
    
    %% Downstream Delivery
    EVENT_BUS -->|8. Forward price_update| SOCKET_IO
    EVENT_BUS -->|8. Forward new_alert| SOCKET_IO
    SOCKET_IO -->|9. Broadcast TCP| SOCKET_CLIENT
    
    %% API queries
    HTTP_CLIENT -->|10. Query Alerts / Symbols| EXPRESS_APP
    EXPRESS_APP -->|11. Query state| ALERT_SVC
    EXPRESS_APP -->|11. Query ticks| STATE_MGR
    SOCKET_CLIENT -->|12. Set React State| VITE_APP
    HTTP_CLIENT -->|12. Set React State| VITE_APP
```

---

## 📦 Component Responsibilities

### 1. Ingestion Layer (`marketFeedClient.js`)
- **Role**: Establishes a persistent Socket.IO connection to the external mock feed server.
- **Resilience**: Configured with infinite reconnection attempts and backoff retry delays.
- **Trigger**: Receives `'ticker'` event packages and forwards them immediately to the normalizer.

### 2. Tick Normalization Service (`normalizer.js`)
- **Role**: Standardizes raw ticks from diverse upstream shapes.
- **Translation**:
  - Maps `SYMBOL` (or `symbol`) to uppercase `symbol`.
  - Extracts `CLOSE` (or `LTP`/`ATP`/`price`) as a float number `price`.
  - Extracts simulated time stamp `TS` (or `timestamp`) as `TS`, converting space-separated datetime strings to ISO 8601.
- **Additional fields**: Passes through `OPEN`, `HIGH`, `LOW`, `TTQ` (volume), `VWAP` for enriched downstream processing.
- **Validation**: Filters out packages missing prices, timestamps, or symbol strings.

### 3. Symbol State Manager (`symbolState.js`)
- **Role**: Manages an in-memory database of ticks per active symbol.
- **Memory Optimization**: Employs a fixed-size ring-buffer per symbol (default: max 500 ticks) to prevent memory leaks during prolonged sessions.
- **Query Support**: Supports the REST route with symbol statistics and active queues.

### 4. Detection Engine & Strategy Modules (`detection/`)
- **Role**: Evaluates individual ticks against mathematical detection models.
- **Dynamic Registration**: Allocates and saves independent strategy contexts for any active trading symbol (including virtual load test streams).
- **Spike Strategy**: Maintains a rolling historical queue of ticks inside a simulated timeframe window (e.g. 30s) and compares the oldest vs newest.
- **Moving Average Strategy**: Evaluates the current price against a sliding sample queue of ticks (e.g. 10 ticks) and determines percentage standard deviation.

### 5. Alert Service (`alertService.js`)
- **Role**: Registers and formats generated anomalies.
- **Formatting**: Assigns a unique, system-verifiable identifier prefixed with `TV-` (e.g., `TV-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`).
- **Caching**: Limits total in-memory alerts to 100 entries.

### 6. Event Bus (`eventBus.js`)
- **Role**: Node.js `EventEmitter` singleton providing pub/sub architecture.
- **Purpose**: Fully decouples feed processing operations from downstream broadcast servers.

### 7. Socket.IO Broadcast Server (`server.js`)
- **Role**: Coordinates real-time streams to frontend dashboards.
- **Initial Handshake**: Pushes the latest 10 cached alerts to newly connected dashboards.
- **Real-Time Stream**: Listens to the `eventBus` for `price_update` and `new_alert` events, multiplexing them to all connected web clients.

---

## 🔄 Detailed Data Flow Sequences

### Sequence A: Ticker Ingestion & Anomaly Detection

```mermaid
sequenceDiagram
    autonumber
    participant UpstreamFeed as Mock Market Feed
    participant Ingestion as MarketFeedClient
    participant Norm as Normalizer
    participant State as SymbolStateManager
    participant Engine as DetectionEngine
    participant Strat as ActiveStrategy
    participant AlertSvc as AlertService
    participant Bus as EventBus
    participant SocketServer as Socket.IO Server
    participant Client as React Dashboard

    UpstreamFeed->>Ingestion: emit('ticker', rawTick)
    Ingestion->>Norm: normalizeTick(rawTick)
    Note over Norm: Map keys: SYMBOL->symbol, CLOSE->price, TS->TS
    Norm-->>Ingestion: returns { symbol, price, TS }
    
    Ingestion->>State: addTick(normalizedTick)
    Note over State: Add to historical ring buffer
    
    Ingestion->>Engine: processTick(normalizedTick)
    Engine->>Strat: process(normalizedTick)
    
    Note over Strat: 1. Add price/TS to strategy window<br/>2. Clear expired items based on simulated TS<br/>3. Calculate variance<br/>4. Validate cooldown simulated time
    
    alt Anomaly Detected & Cooldown Passed
        Strat-->>Engine: return AlertDetails
        Engine->>AlertSvc: createAlert(AlertDetails)
        Note over AlertSvc: Prepend "TV-" prefix to UUIDv4
        AlertSvc-->>Engine: returns formattedAlert
        Engine->>SocketServer: io.emit('new_alert', formattedAlert)
        SocketServer->>Client: emit('new_alert', formattedAlert)
    else No Anomaly or Cooldown Active
        Strat-->>Engine: return null
    end

    Ingestion->>Bus: emit('price_update', normalizedTick)
    Bus->>SocketServer: trigger price_update listener
    SocketServer->>Client: emit('price_update', normalizedTick)
```

---

## 🛠️ Design Patterns

### 1. Strategy Pattern
The platform implements a clean Strategy pattern for anomaly detection. All algorithms extend the `BaseStrategy` class:
- Defines abstract method `process(tick)`.
- Implements simulated cooldown verification (`checkCooldown`).
This makes it simple to plug in new algorithms (e.g., Bollinger Bands, Volume Spike detection) without modifying the ingestion pipelines.

### 2. Factory Pattern (`strategyFactory.js`)
Handles instant instantiation of strategic components based on configured type parameters (e.g. `'spike'` vs `'movingAverage'`). Decouples class implementations from configuration files.

### 3. Singleton Pattern
Core managers such as the `DetectionEngine`, `SymbolStateManager`, `AlertService`, and `eventBus` are implemented as classes and exported as initialized singletons. This guarantees single-source-of-truth states across concurrent modules.

### 4. Pub/Sub (Event Bus)
Utilizes the Node.js `EventEmitter` to publish data updates asynchronously. Helps prevent circular dependency errors between networking clients (`marketFeedClient.js`) and websocket servers (`server.js`).
