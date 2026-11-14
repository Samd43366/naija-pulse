-- Migration 005: Monitors (Saved Locations & Route Corridors) and Alerts
--
-- Concepts explained:
-- 1. Point Monitors vs Commute Route Corridors:
--    - Users can monitor single locations (Home, Office, School) with a radius.
--    - Users can also monitor entire Commute Corridors (e.g. Lekki-Epe expressway,
--      Abuja-Kaduna road) by passing a route line + buffer width.
-- 2. H3 Array + GIN Index Optimization:
--    Instead of recalculating heavy PostGIS ST_DWithin / ST_Intersects queries
--    on every new incoming incident, both point radii and route corridors are
--    pre-discretized into a list of H3 hexagons (monitored_hexes text[]).
--    When an incident occurs in hex H, we match all affected users instantly using
--    PostgreSQL's Generalized Inverted Index (GIN):
--    `SELECT * FROM monitors WHERE monitored_hexes @> ARRAY[incident_hex];`
-- 3. Idempotent Alerting:
--    UNIQUE (monitor_id, incident_id) prevents spamming a user with duplicate
--    alerts for the same event.

CREATE TABLE IF NOT EXISTS monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES reporters(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    monitor_type TEXT NOT NULL DEFAULT 'point' CHECK (monitor_type IN ('point', 'corridor')),
    
    -- Point monitor geometry (optional if corridor)
    center_point GEOGRAPHY(Point, 4326) NULL,
    radius_m INT NULL DEFAULT 1500,
    
    -- Route corridor geometry (optional if point)
    route_geometry GEOGRAPHY(LineString, 4326) NULL,
    corridor_width_m INT NULL DEFAULT 500,
    
    -- Pre-calculated discrete H3 hex set covering this point radius or route corridor
    monitored_hexes TEXT[] NOT NULL,
    
    -- Optional category filtering (e.g. only alert on flood or security)
    category_filter TEXT[] NULL,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitors_reporter ON monitors(reporter_id);
CREATE INDEX IF NOT EXISTS idx_monitors_hexes_gin ON monitors USING GIN (monitored_hexes);

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES reporters(id) ON DELETE CASCADE,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_monitor_incident_alert UNIQUE (monitor_id, incident_id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_reporter ON alerts(reporter_id, read_at);
CREATE INDEX IF NOT EXISTS idx_alerts_incident ON alerts(incident_id);
