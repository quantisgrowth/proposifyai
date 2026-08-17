-- Migration: Fix profiles sync trigger to prevent overwriting custom profile updates
-- When auth.users is updated (such as on sign in), the handle_new_user trigger would
-- run and overwrite profiles.full_name with the original name from auth metadata.
-- By swapping the COALESCE operands, we ensure the existing name in profiles is preserved.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, company_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
  RETURN new;
END; $$;
