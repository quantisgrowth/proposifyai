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
        "proposal_code, total_amount, discount_amount, net_amount, validity_date, payment_terms, notes, status, accepted_at, accepted_by_name, accepted_by_email, accepted_by_document, accepted_by_ip, accepted_by_user_agent, accepted_signature_url, clients(name, document, contact_name, email, phone), proposal_items(title, description, pricing_type, quantity, unit_price, total_price, position)",
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

export const acceptProposalServer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string(),
        signerName: z.string().min(1, "Nome é obrigatório"),
        signerEmail: z.string().email("E-mail inválido"),
        signerDocument: z.string().min(1, "CPF/CNPJ é obrigatório"),
        signerIp: z.string().optional(),
        signerUserAgent: z.string().optional(),
        signatureUrl: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data: { code, signerName, signerEmail, signerDocument, signerIp, signerUserAgent, signatureUrl } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Buscar a proposta, cliente e empresa
    const { data: proposal, error: fetchError } = await supabaseAdmin
      .from("proposals")
      .select("*, clients(*), companies(*)")
      .eq("proposal_code", code)
      .maybeSingle();

    console.log("DIAGNOSTIC - SUPABASE_URL:", process.env['SUPABASE_URL'] || "FALLBACK_DEFAULT");
    console.log("DIAGNOSTIC - proposals columns visible to select:", proposal ? Object.keys(proposal) : "NO_PROPOSAL");

    if (fetchError || !proposal) {
      throw new Error("Proposta não encontrada");
    }

    if (proposal.status === "accepted") {
      return { success: true, alreadyAccepted: true };
    }

    // 2. Atualizar a proposta com os campos de aceite
    const { error: updateError } = await supabaseAdmin
      .from("proposals")
      .update({
        status: "accepted" as const,
        accepted_by_name: signerName,
        accepted_by_email: signerEmail,
        accepted_by_document: signerDocument,
        accepted_by_ip: signerIp || null,
        accepted_by_user_agent: signerUserAgent || null,
        accepted_signature_url: signatureUrl || null,
        accepted_at: new Date().toISOString(),
      } as any)
      .eq("id", proposal.id);

    if (updateError) {
      throw new Error("Falha ao aceitar proposta: " + updateError.message);
    }

    // 3. Buscar e-mail do vendedor que criou a proposta
    let salespersonEmail = proposal.companies?.email || "comercial@proposify.ai";
    let salespersonName = proposal.companies?.name || "Vendedor";

    if (proposal.created_by) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", proposal.created_by)
        .maybeSingle();

      if (profile?.email) {
        salespersonEmail = profile.email;
        if (profile.full_name) {
          salespersonName = profile.full_name;
        }
      }
    }

    // 4. Enviar e-mail de notificação (ex: via Resend se a API Key estiver configurada)
    const resendApiKey = process.env['RESEND_API_KEY'] || process.env['VITE_RESEND_API_KEY'];
    if (resendApiKey) {
      try {
        const formattedValue = Number(proposal.net_amount).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

        const emailBody = {
          from: "Proposify AI <no-reply@proposify.ai>",
          to: [salespersonEmail],
          subject: `Proposta ${code} Aceita! 🎉`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 40px;">🎉</span>
              </div>
              <h2 style="color: #10b981; text-align: center; margin-top: 0; font-size: 24px; font-weight: 700;">Proposta Aceita com Sucesso!</h2>
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">Olá, <strong>${salespersonName}</strong>,</p>
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">Temos ótimas notícias para você! A proposta comercial <strong>${code}</strong> para o cliente <strong>${proposal.clients?.name || "Cliente"}</strong> foi formalmente aceita.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 25px 0;">
                <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; tracking: 0.05em; color: #64748b;">Detalhes do Aceite</h3>
                <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #334155;">
                  <tr>
                    <td style="padding: 4px 0; color: #64748b; width: 140px;"><strong>Responsável:</strong></td>
                    <td style="padding: 4px 0;"><strong>${signerName}</strong> (${signerEmail})</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #64748b;"><strong>Data/Hora:</strong></td>
                    <td style="padding: 4px 0;">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #64748b;"><strong>Valor Líquido:</strong></td>
                    <td style="padding: 4px 0; color: #10b981; font-weight: bold;">${formattedValue}</td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">A proposta já foi movida de forma automática para a coluna de <strong>Ganhas / Aceitas</strong> no seu quadro Kanban.</p>
              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 0;">Boas vendas e excelente projeto!</p>
              
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">Este é um e-mail automático enviado pelo sistema Proposify AI.</p>
            </div>
          `,
        };

        const mailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify(emailBody),
        });

        if (!mailRes.ok) {
          const errText = await mailRes.text();
          console.error("[Email Send Error]", errText);
        }
      } catch (emailErr) {
        console.error("Falha ao enviar e-mail via Resend:", emailErr);
      }
    } else {
      console.log(`[Notification] Resend API Key não configurada. Notificação de aceite para ${salespersonEmail} (Proposta ${code}):`, {
        signerName,
        signerEmail,
        clientName: proposal.clients?.name,
        netAmount: proposal.net_amount,
      });
    }

    return { success: true };
  });
