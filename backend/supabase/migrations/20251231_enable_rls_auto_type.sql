-- Migration: Enable RLS on auto_type
-- Description: Enables Row Level Security on auto_type table where policies already exist
-- Date: 2025-12-31

-- Enable RLS on the table (policy "Enable read access for all users" already exists)
ALTER TABLE public.auto_type ENABLE ROW LEVEL SECURITY;

-- Note: The existing policy grants SELECT to all users, which is appropriate
-- for this catalog table containing vehicle type information
