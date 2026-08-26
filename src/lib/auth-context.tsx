import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Company } from "@/lib/proposals";

type AuthContextType = {
  user: any | null;
  profile: Profile | null;
  company: Company | null;
  isAdmin: boolean;
  isGestor: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  activeCompanyId: string | null;
  accessibleCompanies: Company[];
  setActiveCompany: (companyId: string) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  company: null,
  isAdmin: false,
  isGestor: false,
  loading: true,
  refreshProfile: async () => {},
  activeCompanyId: null,
  accessibleCompanies: [],
  setActiveCompany: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [accessibleCompanies, setAccessibleCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profErr || !profData) {
        const { data: comp } = await supabase.from("companies").select("*").limit(1).maybeSingle();
        setCompany(comp as unknown as Company);
        setAccessibleCompanies(comp ? [comp as unknown as Company] : []);
        setActiveCompanyId(comp?.id || null);
        return;
      }

      const profileObj = profData as unknown as Profile;
      setProfile(profileObj);

      // Fetch accessible companies based on user role
      let companiesList: Company[] = [];
      if (profileObj.role === "admin") {
        const { data: allComps } = await supabase
          .from("companies")
          .select("*")
          .order("name");
        companiesList = (allComps ?? []) as unknown as Company[];
      } else {
        const { data: mappedComps } = await supabase
          .from("profile_companies")
          .select("companies(*)")
          .eq("profile_id", userId);

        companiesList = (mappedComps
          ?.map((m: any) => m.companies)
          .filter(Boolean) ?? []) as unknown as Company[];

        if (companiesList.length === 0 && profileObj.company_id) {
          const { data: primaryComp } = await supabase
            .from("companies")
            .select("*")
            .eq("id", profileObj.company_id)
            .maybeSingle();
          if (primaryComp) {
            companiesList = [primaryComp as unknown as Company];
          }
        }
      }

      setAccessibleCompanies(companiesList);

      let activeId = localStorage.getItem("active-company-id");
      if (!activeId || !companiesList.some((c) => c.id === activeId)) {
        activeId = profileObj.company_id || companiesList[0]?.id || null;
        if (activeId) {
          localStorage.setItem("active-company-id", activeId);
        }
      }
      setActiveCompanyId(activeId);

      const activeCompObj = companiesList.find((c) => c.id === activeId) || null;
      setCompany(activeCompObj);
    } catch (err) {
      console.error("Error fetching profile and companies:", err);
    }
  };

  const setActiveCompany = (companyId: string) => {
    if (accessibleCompanies.some((c) => c.id === companyId)) {
      setActiveCompanyId(companyId);
      localStorage.setItem("active-company-id", companyId);
      const activeCompObj = accessibleCompanies.find((c) => c.id === companyId) || null;
      setCompany(activeCompObj);
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
      setAccessibleCompanies([]);
      setActiveCompanyId(null);
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
        setAccessibleCompanies([]);
        setActiveCompanyId(null);
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
        isGestor: profile?.role === "gestor",
        loading,
        refreshProfile,
        activeCompanyId,
        accessibleCompanies,
        setActiveCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
