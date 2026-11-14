-- Migration 004: Verifications (Community Confirm / Dispute)
--
-- Concepts explained:
-- 1. Anti-Sybil Voting Constraint:
--    UNIQUE (incident_id, reporter_id) prevents a single user or bot device from
--    stuffing the ballot box. Each reporter gets exactly one vote per incident,
--    which can be updated if situation changes (UPSERT).
-- 2. Distance-Weighted Verification:
--    A confirmation from a citizen 50 meters away (in the same H3 hexagon) carries
--    exponentially higher weight in the trust algorithm than a vote cast from 10 km away.
-- 3. Privacy Preservation:
--    We store the distance_m and voter_h3 rather than the exact lat/lng of the voter,
--    ensuring voters cannot be tracked or de-anonymized.

CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES reporters(id) ON DELETE CASCADE,
    vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
    distance_m INT NOT NULL,
    voter_h3 TEXT NOT NULL,
    weight NUMERIC(5, 3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_incident_reporter_vote UNIQUE (incident_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_verifications_incident ON verifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_verifications_reporter ON verifications(reporter_id);
