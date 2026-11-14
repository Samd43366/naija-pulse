-- Migration 006: Hex Stats and Crowdsourced Community Ratings
--
-- Concepts explained:
-- 1. Discrete H3 Intelligence & Prior Probabilities:
--    Instead of arbitrary administrative boundaries, we aggregate intelligence
--    at the H3 hexagon level.
--    - historical_security_risk is calibrated from ACLED conflict data.
--    - historical_flood_risk is calibrated from NEMA historical disaster records.
--    This acts as our Bayesian prior probability P(Incident) for risk prediction.
-- 2. Resident Community Ratings:
--    Verified community members can rate the general livability, power reliability,
--    and safety of their neighborhood hex.
-- 3. Composite Area Score:
--    Blends subjective resident sentiment with objective incident history.

CREATE TABLE IF NOT EXISTS hex_stats (
    h3_index TEXT PRIMARY KEY,
    lga_name TEXT NULL,
    state_name TEXT NULL,
    
    -- Bayesian Prior Risk Weights (0.000 to 1.000)
    historical_security_risk NUMERIC(4, 3) NOT NULL DEFAULT 0.100,
    historical_flood_risk NUMERIC(4, 3) NOT NULL DEFAULT 0.100,
    
    -- Crowdsourced Resident Ratings (1.00 to 5.00)
    community_safety_score NUMERIC(3, 2) NOT NULL DEFAULT 3.00,
    community_power_score NUMERIC(3, 2) NOT NULL DEFAULT 3.00,
    community_livability_score NUMERIC(3, 2) NOT NULL DEFAULT 3.00,
    
    active_incident_count INT NOT NULL DEFAULT 0,
    total_historical_reports INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hex_stats_lga_state ON hex_stats(lga_name, state_name);
CREATE INDEX IF NOT EXISTS idx_hex_stats_active ON hex_stats(active_incident_count);

CREATE TABLE IF NOT EXISTS hex_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    h3_index TEXT NOT NULL,
    reporter_id UUID NOT NULL REFERENCES reporters(id) ON DELETE CASCADE,
    safety_rating SMALLINT NOT NULL CHECK (safety_rating BETWEEN 1 AND 5),
    power_rating SMALLINT NOT NULL CHECK (power_rating BETWEEN 1 AND 5),
    livability_rating SMALLINT NOT NULL CHECK (livability_rating BETWEEN 1 AND 5),
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_hex_reporter_rating UNIQUE (h3_index, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_hex_ratings_h3 ON hex_ratings(h3_index);
CREATE INDEX IF NOT EXISTS idx_hex_ratings_reporter ON hex_ratings(reporter_id);
