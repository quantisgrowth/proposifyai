import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PricingType = Database["public"]["Enums"]["pricing_type"];
export type ProposalStatus = Database["public"]["Enums"]["proposal_status"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Proposal = Database["public"]["Tables"]["proposals"]["Row"];
export type ProposalItem = Database["public"]["Tables"]["proposal_items"]["Row"];

export type ProposalWithClient = Proposal & { clients: Client | null };
export type FullProposal = ProposalWithClient & { proposal_items: ProposalItem[] };

export const clientsQuery = {
  queryKey: ["clients"],
  queryFn: async (): Promise<Client[]> => {
    const { data, error } = await supabase.from("clients").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
};

export const productsQuery = {
  queryKey: ["products"],
  queryFn: async (): Promise<Product[]> => {
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
};

export const proposalsQuery = {
  queryKey: ["proposals"],
  queryFn: async (): Promise<ProposalWithClient[]> => {
    const { data, error } = await supabase
      .from("proposals")
      .select("*, clients(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ProposalWithClient[];
  },
};

export const proposalByCodeQuery = (code: string) => ({
  queryKey: ["proposal", code],
  queryFn: async (): Promise<FullProposal | null> => {
    const { data, error } = await supabase
      .from("proposals")
      .select("*, clients(*), proposal_items(*)")
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

export const COMPANY = {
  name: "Proposify AI",
  tagline: "Estratégia, tecnologia e crescimento",
  email: "comercial@meridian.partners",
  phone: "(11) 4000-2200",
  document: "CNPJ 40.221.884/0001-32",
};
