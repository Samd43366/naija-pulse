# Upgrade roadmap

## Phase 0: establish a reliable baseline

- Keep health reporting truthful for database and fallback storage.
- Add a documented local setup and a single smoke path for report, verify, and route check.
- Identify parity gaps between memory and Postgres implementations.
- Add structured logging with request IDs and storage mode.

## Phase 1: make the domain trustworthy

- Introduce explicit incident status transitions.
- Make report deduplication time-window aware and auditable.
- Enforce one vote per reporter per incident and reject self-verification.
- Store an evidence ledger for report merges and verification changes.
- Return freshness, provenance, location precision, and evidence counts.

## Phase 2: unify storage behavior

- Define repository protocols for incidents, reporters, verifications, monitors, and alerts.
- Implement Postgres and memory repositories against the same protocols.
- Move SQL out of service methods and add integration coverage against PostGIS.
- Make Postgres the default source of truth; keep memory mode as an explicit development mode.

## Phase 3: simplify the product experience

- Make the home screen answer “what is happening near me?” immediately.
- Make reporting a short, resilient flow with draft saving and retry states.
- Show confidence as evidence plus freshness, not only a percentage.
- Keep route checking and monitored areas as clear secondary tasks.
- Add accessible mobile states for loading, empty, offline, and error conditions.

## Phase 4: operational readiness

- Add rate limiting and abuse controls around reports, votes, uploads, and webhooks.
- Add media retention and moderation policies.
- Add metrics for report acceptance, merge accuracy, verification latency, alert delivery, and false-report disputes.
- Add provider-backed SMS/USSD and official agency integrations only after their contracts are available.

