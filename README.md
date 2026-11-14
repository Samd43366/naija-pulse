# Naija Pulse (NaijaPulse) 🇳🇬
> Crowdsourced Real-Time Community Reporting & Area Intelligence Platform for Nigeria.

Built as an advanced university class project exploring **distributed geospatial sensing**, **Bayesian trust modeling**, **discrete global hexagonal indexing (Uber H3)**, and **frictionless zero-login reporting**.

---

## Architecture Overview

```
                        ┌───────────────────────────────────────────────┐
                        │               Web Client (React)              │
                        │   - Leaflet + Uber H3 Hexagonal Grid Layer   │
                        │   - Zero-Login (Device Token in localStorage) │
                        │   - 1-Tap Community Verification Ping         │
                        │   - Route Safety Escort (Commute Checker)     │
                        └───────────────────────┬───────────────────────┘
                                                │ REST / JSON (FastAPI)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FastAPI Backend                                      │
│                                                                                        │
│   ┌─────────────────────┐   ┌──────────────────────┐   ┌───────────────────────────┐   │
│   │  Zero-Friction Auth │   │  H3 Hex Clustering   │   │  Bayesian Trust Engine    │   │
│   │  (Pseudonymous dev  │   │  (Uber H3 Res 7/8/9  │   │  (Laplace reputation +    │   │
│   │   tokens & sliding  │   │   discrete index     │   │   distance decay weights) │   │
│   │   rate limiting)    │   │   lookups)           │   │                           │   │
│   └─────────────────────┘   └──────────────────────┘   └───────────────────────────┘   │
│   ┌─────────────────────┐   ┌──────────────────────┐   ┌───────────────────────────┐   │
│   │  Feature 2: Route   │   │  Feature 3: Offline  │   │  Feature 5: Privacy       │   │
│   │  Safety Escort      │   │  SMS/USSD Webhook    │   │  (Auto EXIF strip &       │   │
│   │  (Corridor buffer)  │   │  Ingestion Gateway   │   │   sensitive crime blur)   │   │
│   └─────────────────────┘   └──────────────────────┘   └───────────────────────────┘   │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │ SQL / Geodetic Operations
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL 16 + PostGIS (Docker Container)                       │
│                                                                                        │
│   - `incidents`: Canonical deduplicated events with H3 spatial keys & public coords    │
│   - `reports`: Citizen submissions with private GPS coordinates & EXIF-stripped media  │
│   - `verifications`: Distance-weighted confirm/dispute votes (anti-ballot stuffing)    │
│   - `monitors`: Saved locations & commute corridors using GIN-indexed H3 arrays        │
│   - `hex_stats`: ACLED historical risk priors + NEMA flood data + resident ratings     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Engineering Highlights

### 1. Uber H3 Hexagonal Zoning
Rather than expensive continuous polygon geometry intersections, Naija Pulse divides the map into discrete hexagons:
- **Res 7** (~1.2 km edge): Regional area summaries and historical crime heatmaps.
- **Res 8** (~460 m edge): Neighborhood incident deduplication and community verification zones.
- **Res 9** (~174 m edge): Street/junction-level precision.
- **GIN Indexing on Commute Corridors**: Routes (e.g. Lekki-Epe expressway, Kaduna-Abuja road) are pre-discretized into arrays of H3 hexes. Matching new incidents to thousands of user commute corridors takes under 2 milliseconds.

### 2. Zero-Friction Reporting ("Auth Without Friction")
Citizens encountering an active robbery, flash flood, or fallen transformer should never be stopped by a registration wall:
- Devices generate a cryptographic `device_token` stored in `localStorage`.
- Reports are ingested immediately with an **"Unconfirmed Bystander"** status.
- New devices start with a baseline Laplace-smoothed reputation of $0.5$. Confirmed reports raise reputation, while disputed submissions lower it.

### 3. Bayesian Trust & Distance-Decay Verification
When community members vote to confirm or dispute an incident:
- Vote weight decays quadratically with distance: someone 50m away has near $1.0$ weight, while someone 2km away has $< 0.1$ weight.
- Trust is calculated dynamically:
  $$\text{Trust} = \frac{k \cdot P_0 + \sum w_{\text{confirm}}}{k + \sum w_{\text{confirm}} + \sum w_{\text{dispute}}}$$
  where $P_0$ is the Bayesian prior probability calibrated from ACLED historical conflict data in that hex.

---

## Quickstart Guide

### 1. Start the Database (Docker)
Ensure Docker Desktop is running, then run:
```bash
docker compose up -d
```
Verify the container is healthy:
```bash
docker ps
```

### 2. Run Database Migrations
Applies PostGIS extensions, table schemas, and category definitions:
```bash
cd backend
python -m app.db.migrate
```

### 3. Seed Realistic Demo Data
Populates the database with historical ACLED/NEMA risk priors and live simulated incidents across Lagos, Abuja, Kaduna, and Port Harcourt:
```bash
python -m scripts.seed_demo_data
```

### 4. Start the FastAPI Server
```bash
uvicorn app.main:app --reload --port 8000
```
Open interactive Swagger API documentation in your browser:
**`http://localhost:8000/docs`**

---

## Implemented API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/incidents/report` | Submit an incident (zero-login auth with auto-deduplication) |
| `GET` | `/api/v1/incidents` | Live map incidents (with privacy blurring for sensitive crimes) |
| `POST` | `/api/v1/incidents/{id}/verify` | Feature 1: One-Tap Community Ping (distance-weighted confirm/dispute) |
| `POST` | `/api/v1/monitors` | Save personal location (Home, Office) or commute route corridor |
| `POST` | `/api/v1/monitors/route-check` | Feature 2: Route Safety Escort (Commute risk check before departure) |
| `GET` | `/api/v1/alerts` | Real-time user alert inbox for monitored locations & routes |
| `POST` | `/api/v1/webhooks/sms` | Feature 3: Offline / Low-Data SMS/USSD Webhook Ingestion Gateway |
| `POST` | `/api/v1/media/upload` | Feature 5: Upload photo with automatic GPS/EXIF metadata stripper |
