# Naija Pulse project guide

## What the product is

Naija Pulse is a community incident intelligence product for Nigeria. Its core loop is:

1. A person reports an incident with a device token instead of an account.
2. The backend normalizes the report, assigns H3 spatial indexes, and merges nearby reports when the category rules allow it.
3. Other nearby people verify or dispute the incident.
4. The system publishes a confidence score, status, location with privacy protection, and freshness information.
5. People can monitor an area or route and receive alerts.

The map is the primary surface, but the product should be judged by whether it helps someone make a safe decision quickly.

## Repository map

### `backend/app`

- `main.py`: FastAPI application, lifecycle, CORS, uploads, and top-level health routes.
- `api/v1`: HTTP endpoints grouped by capability.
- `services`: application workflows and storage branching.
- `core`: deterministic domain calculations such as H3, privacy, and trust math.
- `models`: Pydantic request and response contracts.
- `db/migrations`: Postgres/PostGIS schema migrations.

### `frontend/src`

- `App.jsx`: current application shell and cross-feature state orchestration.
- `components`: map, reporting, incident, route, alert, agency, and chat surfaces.
- `api`: browser-facing API client modules.
- `hooks`: polling, geolocation, theme, and reporter-token state.
- `lib`: offline demo behavior, local chatbot behavior, geo helpers, and shared data rules.

### `backend/scripts` and `data`

Seed generation and ingestion utilities for nationwide demo and research data. These are not the same thing as live community data and should be labeled separately in the product.

## Runtime modes

The backend tries to initialize PostgreSQL during startup. If it cannot connect, the app remains available using the in-memory seed store. This is useful for development and demos, but it creates a consistency risk because the Postgres and memory implementations are separate code paths.

The frontend detects backend availability and can also run local demo behavior. Every new feature must define behavior for both modes or explicitly declare that it requires the backend.

## Domain invariants

These rules should remain true as the project is refactored:

- A reporter is pseudonymous and identified by a device token, not an account identity.
- A verification vote is recomputed on the server from distance and reporter reputation.
- Sensitive incident coordinates are never exposed at full precision.
- Incident trust is bounded to `[0, 1]` and status changes are derived from trust, disputes, and expiry rules.
- Reports are evidence attached to a canonical incident; they are not canonical incidents themselves.
- Seed, official, and crowd sources must remain distinguishable.

## Recommended development loop

1. Run the backend in memory mode first so the API can be exercised without Docker.
2. Run the frontend against the API and verify the main report, verify, and route flows.
3. Start Postgres and run migrations before testing persistence or SQL-specific behavior.
4. Keep domain calculations in `backend/app/core` and test them independently of HTTP and storage.
5. When changing a feature, update the Postgres path and memory path together, then update the frontend offline path if applicable.

## Known risks

- Memory and Postgres behavior can drift because logic is duplicated.
- The current `App.jsx` owns too much cross-feature state, making changes harder to isolate.
- Seed and researched-news records can look like live reports unless the UI makes provenance and freshness explicit.
- A trust percentage can be overinterpreted without showing evidence count, age, and source quality.
- Route safety advice is decision support, not guaranteed safety or emergency response.
- Device-token identity is convenient but vulnerable to token loss, multi-device duplication, and abuse without stronger rate limits.

