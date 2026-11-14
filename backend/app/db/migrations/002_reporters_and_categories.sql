-- Migration 002: Reporters and Categories
--
-- Concepts explained:
-- 1. Pseudonymous Reporters (Zero-Login Auth):
--    Every client device creates a unique, cryptographic device_token stored in localStorage.
--    This allows instant incident reporting without signup friction, while still giving us
--    a persistent identifier to track trust, rate-limit abuse, and prevent spam.
-- 2. Progressive Profiling:
--    email and phone_number are optional. When a user chooses to "claim" their profile,
--    they link their email or phone without losing their reporting history.
-- 3. Dynamic Categories:
--    Incident lifespans (TTL), deduplication radii, and sensitivity flags live in data,
--    so we can tune behavior without modifying backend code or redeploying.

CREATE TABLE IF NOT EXISTS reporters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_token TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT 'Bystander',
    email TEXT UNIQUE NULL,
    phone_number TEXT UNIQUE NULL,
    role TEXT NOT NULL DEFAULT 'bystander' CHECK (role IN ('bystander', 'verified_citizen', 'moderator', 'admin')),
    reports_confirmed INT NOT NULL DEFAULT 0,
    reports_disputed INT NOT NULL DEFAULT 0,
    trust_points INT NOT NULL DEFAULT 0,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reporters_device_token ON reporters(device_token);

CREATE TABLE IF NOT EXISTS categories (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    icon TEXT NOT NULL,
    default_ttl INTERVAL NOT NULL,
    dedup_radius_m INT NOT NULL,
    dedup_window INTERVAL NOT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    blur_radius_m INT NOT NULL DEFAULT 0
);

-- Seed initial Nigerian incident categories
INSERT INTO categories (code, name, color_hex, icon, default_ttl, dedup_radius_m, dedup_window, is_sensitive, blur_radius_m)
VALUES
    ('power_outage', 'Power Outage', '#F59E0B', 'zap', INTERVAL '90 minutes', 1500, INTERVAL '3 hours', FALSE, 0),
    ('flood', 'Flood & Drainage', '#3B82F6', 'droplet', INTERVAL '12 hours', 750, INTERVAL '24 hours', FALSE, 0),
    ('kidnapping_security', 'Kidnapping & Security', '#EF4444', 'shield-alert', INTERVAL '6 hours', 500, INTERVAL '6 hours', TRUE, 500),
    ('road_condition', 'Road Hazard & Gully', '#F97316', 'alert-triangle', INTERVAL '72 hours', 150, INTERVAL '72 hours', FALSE, 0),
    ('disaster_fire', 'Fire & Explosion', '#DC2626', 'flame', INTERVAL '4 hours', 400, INTERVAL '6 hours', FALSE, 0),
    ('other', 'Other Incident', '#6B7280', 'info', INTERVAL '24 hours', 250, INTERVAL '12 hours', FALSE, 0)
ON CONFLICT (code) DO NOTHING;
