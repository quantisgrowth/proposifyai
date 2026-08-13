-- Migration: Add client proposal acceptance details
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_name text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_email text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
