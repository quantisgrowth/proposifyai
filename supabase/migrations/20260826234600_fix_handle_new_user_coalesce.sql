-- Migration: Fix profiles handle_new_user trigger coalesce precedence
-- Description: Ensures that existing non-null profile data is preserved rather than overwritten by EXCLUDED metadata when handle_new_user fires on UPDATE.

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
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    first_name = COALESCE(profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(profiles.last_name, EXCLUDED.last_name),
    cpf = COALESCE(profiles.cpf, EXCLUDED.cpf),
    phone = COALESCE(profiles.phone, EXCLUDED.phone);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
