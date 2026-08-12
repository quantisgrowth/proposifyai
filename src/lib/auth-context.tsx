import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Company } from "@/lib/proposals";

type AuthContextType = {
  user: any | null;
  profile: Profile | null;
  company: Company | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  company: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, company:companies(*)")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as unknown as Profile);
        setCompany((data as any).company ?? null);
      } else {
        // Fallback: se o perfil ainda não existe no banco, busca a primeira empresa
        const { data: comp } = await supabase.from("companies").select("*").limit(1).maybeSingle();
        setCompany(comp as unknown as Company);
      }
    } catch {
      // Silencioso
    }
  };

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      setUser(data.session.user);
      await fetchProfile(data.session.user.id);
    } else {
      setUser(null);
      setProfile(null);
      setCompany(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshProfile();
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setCompany(null);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        company,
        isAdmin: profile?.role === "admin",
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
