import crypto from "crypto";

export async function triggerWebhook(
  companyId: string,
  event: "proposal.accepted" | "proposal.sent" | "proposal.rejected" | "proposal.created",
  proposal: any
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch webhook configuration
    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .select("webhook_url, webhook_secret")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !company || !company.webhook_url) {
      console.log(`[Webhook] Skipped for company ${companyId}: No webhook URL configured`);
      return;
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        id: proposal.id,
        proposal_code: proposal.proposal_code,
        status: proposal.status,
        campaign_name: proposal.campaign_name,
        solution_name: proposal.solution_name,
        total_amount: proposal.total_amount,
        discount_amount: proposal.discount_amount,
        net_amount: proposal.net_amount,
        validity_date: proposal.validity_date,
        payment_terms: proposal.payment_terms,
        notes: proposal.notes,
        accepted_by_name: proposal.accepted_by_name,
        accepted_by_email: proposal.accepted_by_email,
        accepted_by_document: proposal.accepted_by_document,
        accepted_by_ip: proposal.accepted_by_ip,
        accepted_by_user_agent: proposal.accepted_by_user_agent,
        accepted_at: proposal.accepted_at,
        client: proposal.clients ? {
          name: proposal.clients.name,
          document: proposal.clients.document,
          email: proposal.clients.email,
          phone: proposal.clients.phone,
          contact_name: proposal.clients.contact_name,
        } : null,
      },
    };

    const payloadStr = JSON.stringify(payload);
    const secret = company.webhook_secret || "";
    
    // Generate signature using HMAC-SHA256
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadStr)
      .digest("hex");

    console.log(`[Webhook] Dispatching to ${company.webhook_url} for event ${event}`);

    const response = await fetch(company.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Proposify-Signature": signature,
        "X-Proposify-Event": event,
      },
      body: payloadStr,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Webhook Error] Failed dispatch to ${company.webhook_url}: Status ${response.status} - ${text}`);
    } else {
      console.log(`[Webhook] Successfully dispatched to ${company.webhook_url}`);
    }
  } catch (err) {
    console.error("[Webhook Error] Critical failure in triggerWebhook:", err);
  }
}
