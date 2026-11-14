# Target architecture

## Direction

The target is a modular monolith first: one FastAPI deployment, one React client, and Postgres/PostGIS as the source of truth. This keeps deployment and debugging realistic while leaving clear seams for later extraction.

## Backend layers

```text
HTTP routers -> application services -> repositories -> Postgres/PostGIS
                    |                 
                    +-> domain/core calculations
```

- Routers validate transport input and map errors to HTTP responses.
- Application services coordinate workflows such as report ingestion, verification, route analysis, and alerts.
- Repositories hide storage details. The current direct SQL plus memory branching should move behind matching repository interfaces.
- Core functions stay pure and deterministic: trust, privacy, H3, deduplication decisions, and status transitions.

The first structural refactor should introduce repository interfaces without changing API behavior. The in-memory repository can remain useful for tests and local demos, but it must implement the same contract as Postgres.

## Canonical incident lifecycle

```text
reported -> unconfirmed -> active -> resolved
                 |            |
                 +-> disputed +-> expired
```

The lifecycle needs explicit transition rules and an audit record. A report merge may add evidence and extend freshness, but it should not silently replace the original event.

## Frontend direction

Move state out of the current all-purpose `App.jsx` into feature controllers:

- `incidents`: list, detail, report, verification
- `map`: camera, filters, selected hex, selected incident
- `route`: route input, scan state, result, monitor save
- `alerts`: monitors, inbox, read state
- `session`: reporter token, backend mode, connectivity

The shell should compose these controllers and render task-oriented screens. API modules should return normalized records with source, freshness, and confidence metadata.

## Data contracts to add

Every incident response should expose or derive:

- `status`
- `source_type` (`crowd`, `official`, `seed`, `research`)
- `observed_at`, `last_activity_at`, `expires_at`
- `trust_score`
- `evidence_count` and confirm/dispute counts
- `location_precision` (`exact`, `neighborhood`, `macro`)

This gives the UI enough information to explain why an incident is shown.

