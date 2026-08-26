-- Migration: Add extra profile fields and update trigger
-- Description: Adds first_name, last_name, cpf, and phone to profiles. Synchronizes existing full_name data.

-- 1. Add columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2. Populate first_name and last_name from existing full_name
UPDATE public.profiles 
SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = COALESCE(NULLIF(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1), full_name), '')
WHERE full_name IS NOT NULL AND first_name IS NULL;

-- 3. Update the handle_new_user trigger function to support metadata sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id, first_name, last_name, cpf, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'colaborador'),
    COALESCE((new.raw_user_meta_data->>'company_id')::uuid, (SELECT id FROM public.companies LIMIT 1)),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'cpf',
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    cpf = COALESCE(EXCLUDED.cpf, profiles.cpf),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
