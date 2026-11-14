-- Migration 003: Incidents and Reports
--
-- Concepts explained:
-- 1. Reports vs Incidents (Deduplication Core):
--    - A "report" is a single citizen/source submission ("I see flooding here").
--    - An "incident" is the canonical ground truth entity. When multiple reports of the
--      same category occur within the deduplication radius and time window, they are merged
--      into the existing incident rather than cluttering the map with duplicate pins.
-- 2. Uber H3 Hexagonal Hierarchy:
--    We store the H3 index at three standard resolutions on the incident:
--    - h3_res7 (~1.2km): Used for macro area heatmaps and LGA summaries.
--    - h3_res8 (~460m): Used for neighborhood deduplication and nearby community alerts.
--    - h3_res9 (~174m): Used for pinpoint street/junction matching.
-- 3. Public vs Exact Location (Privacy & Safety):
--    For sensitive categories (e.g. kidnapping, targeted attacks), public_location is
--    snapped to the H3 hexagon centroid or jittered, preventing bad actors from pinpointing
--    exact victim residences or operational squads.
-- 4. Lazy Expiry:
--    Incidents expire automatically when `now() > expires_at`. Verifications and fresh
--    reports push `expires_at` forward in time, keeping live situations active.

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code TEXT NOT NULL REFERENCES categories(code),
    title TEXT NOT NULL,
    summary TEXT NULL,
    
    -- Uber H3 discrete spatial keys
    h3_res7 TEXT NOT NULL,
    h3_res8 TEXT NOT NULL,
    h3_res9 TEXT NOT NULL,
    
    -- PostGIS geospatial coordinates (SRID 4326 = WGS84 GPS coords)
    exact_location GEOGRAPHY(Point, 4326) NOT NULL,
    public_location GEOGRAPHY(Point, 4326) NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (status IN ('unconfirmed', 'active', 'resolved', 'expired', 'removed', 'historical')),
    trust_score NUMERIC(4, 3) NOT NULL DEFAULT 0.300 CHECK (trust_score >= 0.0 AND trust_score <= 1.0),
    report_count INT NOT NULL DEFAULT 1,
    confirm_count INT NOT NULL DEFAULT 0,
    dispute_count INT NOT NULL DEFAULT 0,
    
    first_reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    source TEXT NOT NULL DEFAULT 'crowd' CHECK (source IN ('crowd', 'acled', 'nema', 'official', 'sms_webhook')),
    external_id TEXT UNIQUE NULL
);

-- Fast geospatial and spatial index lookups
CREATE INDEX IF NOT EXISTS idx_incidents_public_location ON incidents USING GIST (public_location);
CREATE INDEX IF NOT EXISTS idx_incidents_exact_location ON incidents USING GIST (exact_location);
CREATE INDEX IF NOT EXISTS idx_incidents_h3_res7 ON incidents(h3_res7);
CREATE INDEX IF NOT EXISTS idx_incidents_h3_res8 ON incidents(h3_res8);
CREATE INDEX IF NOT EXISTS idx_incidents_h3_res9 ON incidents(h3_res9);
CREATE INDEX IF NOT EXISTS idx_incidents_status_expires ON incidents(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category_code);

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    reporter_id UUID NULL REFERENCES reporters(id) ON DELETE SET NULL,
    
    h3_index TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    gps_accuracy_m INT NULL,
    
    description TEXT NOT NULL,
    media_url TEXT NULL,
    
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_incident ON reports(incident_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_h3 ON reports(h3_index);
