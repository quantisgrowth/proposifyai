-- Migration: Support 'gestor' role, update RLS and add role synchronization trigger

-- 1. Update CHECK constraint on profiles role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'colaborador', 'gestor'));

-- 2. Create trigger to keep user_roles in sync automatically
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin'::public.app_role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_profile_role ON public.profiles;
CREATE TRIGGER tr_sync_profile_role
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- 3. Update Profiles RLS policies to allow gestor full access to their company profiles
DROP POLICY IF EXISTS "profiles admin write" ON public.profiles;
CREATE POLICY "profiles admin write" ON public.profiles FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    (role = 'gestor' AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    (role = 'gestor' AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  );
