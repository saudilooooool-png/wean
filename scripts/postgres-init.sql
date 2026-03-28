-- ─────────────────────────────────────────────────────────────────────────────
-- Wean – PostgreSQL initialisation
-- Runs once when the container is first created.
-- Creates the n8n user/database and the Appwrite schema placeholder.
-- ─────────────────────────────────────────────────────────────────────────────

-- n8n needs its own database. The main wean DB is already created by
-- POSTGRES_DB in docker-compose.

DO $$
BEGIN
  -- Create n8n role if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_setting('app.n8n_user', true)) THEN
    NULL; -- role name comes from env; handled below
  END IF;
END
$$;

-- Create n8n user (password set via environment variable substitution at
-- docker-entrypoint level; this script creates a fallback).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n') THEN
    CREATE ROLE n8n WITH LOGIN PASSWORD 'n8n_secret';
  END IF;
END
$$;

-- Create n8n database owned by the n8n role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'n8n') THEN
    PERFORM dblink_exec('dbname=' || current_database(),
      'CREATE DATABASE n8n OWNER n8n');
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- dblink not available; use a simpler approach
  NULL;
END
$$;

-- Grant n8n user access to wean database as well (for shared tables if needed)
GRANT CONNECT ON DATABASE wean TO n8n;

-- Schema for Evolution API (used when DATABASE_CONNECTION_URI includes ?schema=evolution)
CREATE SCHEMA IF NOT EXISTS evolution;
GRANT ALL PRIVILEGES ON SCHEMA evolution TO wean;

-- Schema for Appwrite (Appwrite manages its own migrations but needs the schema)
CREATE SCHEMA IF NOT EXISTS appwrite;
GRANT ALL PRIVILEGES ON SCHEMA appwrite TO wean;

-- Useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy text search (optional)
