import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const testSmtpConnectionServer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        host: z.string(),
        port: z.number(),
        user: z.string(),
        pass: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data: { host, port, user, pass } }) => {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
      connectionTimeout: 5000, // 5 seconds connection timeout
    });

    try {
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      throw new Error("SMTP connection failed: " + err.message);
    }
  });

export const sendOfficialProposalEmailServer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        proposalId: z.string(),
        toEmail: z.string().email(),
        subject: z.string(),
        bodyHtml: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data: { proposalId, toEmail, subject, bodyHtml } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { triggerWebhook } = await import("@/lib/webhooks.server");
    
    // 1. Fetch proposal, company and client
    const { data: proposal, error: propErr } = await supabaseAdmin
      .from("proposals")
      .select("*, companies(*), clients(*)")
      .eq("id", proposalId)
      .maybeSingle();

    if (propErr || !proposal) {
      throw new Error("Proposta não encontrada");
    }

    const company = proposal.companies;
    if (!company) {
      throw new Error("Empresa associada não encontrada");
    }

    let emailSent = false;
    let methodUsed = "";

    // 2. Check if company has SMTP settings
    if (company.smtp_host && company.smtp_port && company.smtp_user && company.smtp_pass) {
      console.log(`[SMTP] Sending email via company SMTP: ${company.smtp_host}`);
      
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: company.smtp_host,
        port: company.smtp_port,
        secure: company.smtp_port === 465,
        auth: {
          user: company.smtp_user,
          pass: company.smtp_pass,
        },
      });

      const fromEmail = company.smtp_from || company.smtp_user;
      const fromName = company.smtp_from_name || company.name;

      try {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: toEmail,
          subject: subject,
          html: bodyHtml,
        });
        emailSent = true;
        methodUsed = "smtp";
      } catch (err: any) {
        throw new Error("Failed sending email via SMTP: " + err.message);
      }
    } else {
      // 3. Fallback: Resend
      const resendApiKey = process.env['RESEND_API_KEY'] || process.env['VITE_RESEND_API_KEY'];
      if (resendApiKey) {
        console.log("[SMTP] Fallback to Resend");
        const fromName = company.name || "Proposify AI";
        
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: `${fromName} <no-reply@proposify.ai>`,
              to: [toEmail],
              subject: subject,
              html: bodyHtml,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText);
          }
          emailSent = true;
          methodUsed = "resend";
        } catch (err: any) {
          throw new Error("Failed sending email via Resend fallback: " + err.message);
        }
      }
    }

    if (emailSent) {
      const oldStatus = proposal.status;
      
      // Update proposal status to sent if it was draft
      if (proposal.status === "draft") {
        const { error: updErr } = await supabaseAdmin
          .from("proposals")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", proposalId);

        if (!updErr) {
          const { data: updatedProposal } = await supabaseAdmin
            .from("proposals")
            .select("*, clients(*)")
            .eq("id", proposalId)
            .maybeSingle();

          if (updatedProposal) {
            // Dispatch webhook
            triggerWebhook(updatedProposal.company_id, "proposal.sent", updatedProposal);
          }
        }
      }

      return { success: true, method: methodUsed };
    }

    throw new Error("SMTP or Resend email integration is not configured");
  });
