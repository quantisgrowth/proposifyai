import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{3,40}$/, "Código inválido");

/**
 * Public, read-only access to a single shared proposal by its exact code.
 * Drafts are never exposed, and only the fields printed on the document are returned.
 */
export const getPublicProposal = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => codeSchema.parse(data))
  .handler(async ({ data: code }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: proposal, error } = await supabaseAdmin
      .from("proposals")
      .select(
        "proposal_code, total_amount, discount_amount, net_amount, validity_date, payment_terms, notes, status, clients(name, document, contact_name, email, phone), proposal_items(title, description, pricing_type, quantity, unit_price, total_price, position)",
      )
      .eq("proposal_code", code)
      .neq("status", "draft")
      .maybeSingle();

    if (error) {
      console.error("[getPublicProposal]", error);
      throw new Error("Não foi possível carregar a proposta");
    }
    if (!proposal) return null;

    return {
      ...proposal,
      proposal_items: [...(proposal.proposal_items ?? [])].sort(
        (a, b) => a.position - b.position,
      ),
    };
  });
