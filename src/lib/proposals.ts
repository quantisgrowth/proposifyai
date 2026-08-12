import { supabase } from "@/integrations/supabase/client";

export type PricingType = "recurring" | "one_time" | "setup";
export type ProposalStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type UserRole = "admin" | "colaborador";

export type Company = {
  id: string;
  name: string;
  tagline: string;
  document: string;
  email: string;
  phone: string;
  default_validity_days: number;
  default_payment_terms: string;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  company?: Company | null;
};

export type Client = {
  id: string;
  name: string;
  document: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  company_id?: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  pricing_type: PricingType;
  active: boolean;
  company_id?: string | null;
  created_at: string;
};

export type Proposal = {
  id: string;
  proposal_code: string;
  client_id: string | null;
  company_id?: string | null;
  created_by?: string | null;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  validity_date: string | null;
  payment_terms: string | null;
  notes: string | null;
  status: ProposalStatus;
  sent_at: string | null;
  created_at: string;
};

export type ProposalItem = {
  id: string;
  proposal_id: string;
  product_id: string | null;
  title: string;
  description: string | null;
  pricing_type: PricingType;
  quantity: number;
  unit_price: number;
  total_price: number;
  position: number;
  created_at: string;
};

export type ProposalWithClient = Proposal & { clients: Client | null; companies?: Company | null };
export type FullProposal = ProposalWithClient & { proposal_items: ProposalItem[] };

export const companiesQuery = {
  queryKey: ["companies"],
  queryFn: async (): Promise<Company[]> => {
    const { data, error } = await supabase.from("companies").select("*").order("name");
    if (error) {
      // Fallback para company_settings se a tabela companies ainda não tiver rodado a migration
      const { data: fallback, error: fbErr } = await supabase.from("company_settings").select("*");
      if (fbErr) throw error;
      return (fallback ?? []) as unknown as Company[];
    }
    return (data ?? []) as unknown as Company[];
  },
};

export const companyByIdQuery = (companyId: string | null | undefined) => ({
  queryKey: ["company", companyId],
  enabled: Boolean(companyId),
  queryFn: async (): Promise<Company | null> => {
    if (!companyId) return null;
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    if (error) {
      const { data: fallback } = await supabase.from("company_settings").select("*").maybeSingle();
      return fallback as unknown as Company | null;
    }
    return (data as unknown as Company) ?? null;
  },
});

export const profilesQuery = {
  queryKey: ["profiles"],
  queryFn: async (): Promise<(Profile & { company: Company | null })[]> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, company:companies(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as (Profile & { company: Company | null })[];
  },
};

export const currentProfileQuery = (userId: string | null | undefined) => ({
  queryKey: ["current_profile", userId],
  enabled: Boolean(userId),
  queryFn: async (): Promise<Profile | null> => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*, company:companies(*)")
      .eq("id", userId)
      .maybeSingle();
    if (error) return null;
    return (data as unknown as Profile) ?? null;
  },
});

export const clientsQuery = (companyId?: string | null) => ({
  queryKey: ["clients", companyId],
  queryFn: async (): Promise<Client[]> => {
    let q = supabase.from("clients").select("*").order("name");
    if (companyId) {
      q = q.eq("company_id", companyId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as Client[];
  },
});

export const productsQuery = (companyId?: string | null) => ({
  queryKey: ["products", companyId],
  queryFn: async (): Promise<Product[]> => {
    let q = supabase.from("products").select("*").order("name");
    if (companyId) {
      q = q.eq("company_id", companyId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as Product[];
  },
});

export const proposalsQuery = (companyId?: string | null) => ({
  queryKey: ["proposals", companyId],
  queryFn: async (): Promise<ProposalWithClient[]> => {
    let q = supabase
      .from("proposals")
      .select("*, clients(*), companies(*)")
      .order("created_at", { ascending: false });
    if (companyId) {
      q = q.eq("company_id", companyId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as ProposalWithClient[];
  },
});

export const proposalByCodeQuery = (code: string) => ({
  queryKey: ["proposal", code],
  queryFn: async (): Promise<FullProposal | null> => {
    const { data, error } = await supabase
      .from("proposals")
      .select("*, clients(*), companies(*), proposal_items(*)")
      .eq("proposal_code", code)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const full = data as unknown as FullProposal;
    full.proposal_items = [...(full.proposal_items ?? [])].sort((a, b) => a.position - b.position);
    return full;
  },
});

export async function nextProposalCode() {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("proposals")
    .select("proposal_code")
    .like("proposal_code", `PRP-${year}-%`)
    .order("proposal_code", { ascending: false })
    .limit(1);
  const last = data?.[0]?.proposal_code;
  const n = last ? parseInt(last.split("-")[2] ?? "0", 10) + 1 : 1;
  return `PRP-${year}-${String(n).padStart(4, "0")}`;
}

export const COMPANY: Company = {
  id: "default",
  name: "Proposify AI",
  tagline: "Estratégia, tecnologia e crescimento",
  email: "comercial@proposify.ai",
  phone: "(11) 4000-2200",
  document: "CNPJ 40.221.884/0001-32",
  default_validity_days: 15,
  default_payment_terms: "Pix",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const companySettingsQuery = {
  queryKey: ["company_settings"],
  retry: false,
  queryFn: async (): Promise<Company | null> => {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) {
      const { data: fb } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      return (fb as unknown as Company) ?? null;
    }
    return (data as unknown as Company) ?? null;
  },
};
