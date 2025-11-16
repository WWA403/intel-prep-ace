-- Initialize database for local development
-- This creates minimal auth schema to satisfy foreign key constraints

-- Create auth schema (minimal version for local dev)
CREATE SCHEMA IF NOT EXISTS auth;

-- Create minimal auth.users table for foreign key references
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  encrypted_password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Now apply the main schema
-- (Will be loaded from migrations after this)
