-- Migration: Add ASAAS tracking columns to public.proposals

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS asaas_customer_id text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS asaas_payment_id text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS asaas_payment_url text;
