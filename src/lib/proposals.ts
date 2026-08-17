import { supabase } from "@/integrations/supabase/client";

export type PricingType = "recurring" | "one_time" | "setup" | "usage_based";
export type ProposalStatus = string;
export type UserRole = "admin" | "colaborador";

export type KanbanColumn = {
  id: string;
  company_id: string | null;
  name: string;
  slug: string;
  color: string;
  position: number;
  created_at: string;
};

export type Company = {
  id: string;
  name: string;
  tagline: string;
  document: string;
  email: string;
  phone: string;
  logo_url?: string | null;
  brand_color?: string | null;
  footer_text?: string | null;
  solution_name?: string | null;
  objective_text?: string | null;
  scope_text?: string | null;
  fidelity_policy?: string | null;
  next_steps_text?: string | null;
  default_validity_days: number;
  default_payment_terms: string;
  created_at: string;
  updated_at: string;
  only_view_own_proposals?: boolean;
  require_all_fields?: boolean;
  block_proposal_deletion?: boolean;
  delete_allowed_users?: string[];
  api_key?: string | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_pass?: string | null;
  smtp_from?: string | null;
  smtp_from_name?: string | null;
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

export type PricingTier = {
  range: string;
  price: number;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  min_price?: number | null;
  max_price?: number | null;
  pricing_tiers?: PricingTier[] | null;
  pricing_tier_notes?: string | null;
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
  campaign_name?: string | null;
  solution_name?: string | null;
  objective_text?: string | null;
  scope_text?: string | null;
  fidelity_policy?: string | null;
  next_steps_text?: string | null;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  validity_date: string | null;
  payment_terms: string | null;
  notes: string | null;
  status: ProposalStatus;
  sent_at: string | null;
  accepted_at?: string | null;
  accepted_by_name?: string | null;
  accepted_by_email?: string | null;
  accepted_by_document?: string | null;
  accepted_by_ip?: string | null;
  accepted_by_user_agent?: string | null;
  accepted_signature_url?: string | null;
  created_at: string;
  loss_reason?: string | null;
  loss_description?: string | null;
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
  original_price?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  pricing_tiers?: PricingTier[] | null;
  pricing_tier_notes?: string | null;
  is_included?: boolean;
  total_price: number;
  position: number;
  created_at: string;
};

export type ProposalWithClient = Proposal & { clients: Client | null; companies?: Company | null };
export type FullProposal = ProposalWithClient & { proposal_items: ProposalItem[] };

export const companiesQuery = {
  queryKey: ["companies"],
  staleTime: 5 * 60 * 1000, // 5 min
  gcTime: 10 * 60 * 1000,
  queryFn: async (): Promise<Company[]> => {
    const { data, error } = await supabase.from("companies").select("*").order("name");
    if (error) {
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
  staleTime: 5 * 60 * 1000, // 5 min
  gcTime: 10 * 60 * 1000,
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
  staleTime: 1 * 60 * 1000, // 1 min
  gcTime: 5 * 60 * 1000,
  queryFn: async (): Promise<(Profile & { company: Company | null; company_ids: string[] })[]> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, company:companies!profiles_company_id_fkey(*), profile_companies(company_id)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    
    return (data ?? []).map((p: any) => ({
      ...p,
      company_ids: p.profile_companies?.map((pc: any) => pc.company_id) ?? []
    })) as unknown as (Profile & { company: Company | null; company_ids: string[] })[];
  },
};

export const currentProfileQuery = (userId: string | null | undefined) => ({
  queryKey: ["current_profile", userId],
  enabled: Boolean(userId),
  queryFn: async (): Promise<Profile | null> => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*, company:companies!profiles_company_id_fkey(*)")
      .eq("id", userId)
      .maybeSingle();
    if (error) return null;
    return (data as unknown as Profile) ?? null;
  },
});

export const clientsQuery = (companyId?: string | null) => ({
  queryKey: ["clients", companyId],
  staleTime: 30 * 1000, // 30 sec
  gcTime: 2 * 60 * 1000,
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
  staleTime: 2 * 60 * 1000, // 2 min
  gcTime: 5 * 60 * 1000,
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

export const proposalsQuery = (companyId?: string | null, onlyViewOwn?: boolean, userId?: string | null) => ({
  queryKey: ["proposals", companyId, onlyViewOwn, userId],
  queryFn: async (): Promise<ProposalWithClient[]> => {
    let q = supabase
      .from("proposals")
      .select("*, clients(*), companies(*)")
      .order("created_at", { ascending: false });
    if (companyId) {
      q = q.eq("company_id", companyId);
    }
    if (onlyViewOwn && userId) {
      q = q.eq("created_by", userId);
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
  staleTime: 5 * 60 * 1000, // 5 min
  gcTime: 10 * 60 * 1000,
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

export const kanbanColumnsQuery = (companyId?: string | null) => ({
  queryKey: ["kanban_columns", companyId],
  staleTime: 5 * 60 * 1000, // 5 min
  gcTime: 10 * 60 * 1000,
  queryFn: async (): Promise<KanbanColumn[]> => {
    let q = supabase.from("kanban_columns").select("*").order("position");
    if (companyId) {
      q = q.eq("company_id", companyId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as KanbanColumn[];
  },
});
