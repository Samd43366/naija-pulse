-- Migration 001: Enable core PostgreSQL and PostGIS extensions
-- 
-- Concepts explained:
-- 1. postgis: Provides spatial types like geography(Point, 4326) and multi-polygons,
--    enabling geodetic calculations (measuring distances in real-world meters).
-- 2. pgcrypto: Provides gen_random_uuid() for distributed, non-enumerable primary keys.
-- 3. btree_gist: Enables combining standard data types (e.g. timestamps, text) with
--    spatial geometries in GiST indexes.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
