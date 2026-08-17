-- Migration: Add Integration Settings and Multi-Company Collaborators Support

-- 1. Add integration columns to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS api_key uuid DEFAULT gen_random_uuid();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS webhook_secret text DEFAULT md5(random()::text);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_host text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_port integer;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_user text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_pass text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_from text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_from_name text;

-- Ensure all existing companies have a default API key
UPDATE public.companies SET api_key = gen_random_uuid() WHERE api_key IS NULL;

-- 2. Create profile_companies table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.profile_companies (
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, company_id)
);

-- Enable RLS and permissions
ALTER TABLE public.profile_companies ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.profile_companies TO authenticated, service_role;
GRANT SELECT ON public.profile_companies TO anon;
DROP POLICY IF EXISTS "profile_companies_access" ON public.profile_companies;
CREATE POLICY "profile_companies_access" ON public.profile_companies FOR ALL USING (true) WITH CHECK (true);

-- 3. Populate profile_companies with existing associations from profiles
INSERT INTO public.profile_companies (profile_id, company_id)
SELECT id, company_id 
FROM public.profiles 
WHERE company_id IS NOT NULL
ON CONFLICT (profile_id, company_id) DO NOTHING;
