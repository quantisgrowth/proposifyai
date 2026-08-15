ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_document TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_ip TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_user_agent TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_signature_url TEXT;
