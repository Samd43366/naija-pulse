# Architecture decisions

## ADR-001: modular monolith before microservices

Naija Pulse has several related workflows and is still changing quickly. Keeping them in one deployable backend reduces operational overhead and makes domain behavior easier to trace. Repository and service boundaries provide an extraction path later.

## ADR-002: Postgres is the production source of truth

PostGIS is needed for persistence, spatial queries, monitoring, and operational history. The in-memory store remains for local demos and deterministic tests, but it must not silently claim production durability.

## ADR-003: H3 for indexing, PostGIS for geometry

H3 is efficient for clustering, route corridors, and neighborhood aggregation. PostGIS remains appropriate for exact distance, geometry, and database-side filtering. They solve different problems and should not be treated as interchangeable.

## ADR-004: trust is evidence-weighted, not a label

Trust should be calculated from report and verification evidence, reporter reputation, distance, prior risk, and age. The UI must expose the contributing evidence so users do not mistake a model score for certainty.

## ADR-005: privacy is enforced at the response boundary

Sensitive locations may be stored privately for deduplication and operations, but public responses must use a deliberately reduced precision. Media metadata is stripped before public use.

## ADR-006: offline mode is an explicit product mode

Offline/demo behavior is valuable for development and low-connectivity contexts, but it must be visibly labeled and contract-compatible with the live backend. Silent divergence between simulated and live behavior is a correctness risk.

