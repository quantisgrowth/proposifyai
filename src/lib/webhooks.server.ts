import crypto from "crypto";

export async function triggerWebhook(
  companyId: string | null,
  event: "proposal.accepted" | "proposal.sent" | "proposal.rejected" | "proposal.created",
  proposal: any
) {
  if (!companyId) return;
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

    // Try to find the active flow for this event
    const { data: activeFlow } = await supabaseAdmin
      .from("automation_flows")
      .select("id")
      .eq("company_id", companyId)
      .eq("trigger_type", event)
      .eq("is_active", true)
      .maybeSingle();

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

    // Helper to log outgoing integration
    const logOutgoing = async (statusCodeVal: number | null, responseBodyVal: string | null, errMsgVal: string | null) => {
      try {
        await supabaseAdmin.from("integration_logs").insert({
          company_id: companyId,
          flow_id: activeFlow?.id || null,
          direction: "outgoing",
          event_type: event,
          status_code: statusCodeVal,
          payload: payload,
          response_body: responseBodyVal,
          error_message: errMsgVal
        });
      } catch (logErr) {
        console.error("[Webhook Log Error]:", logErr);
      }
    };

    let responseText = "";
    let statusCode: number | null = null;
    let errorMsg: string | null = null;

    try {
      const response = await fetch(company.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Proposify-Signature": signature,
          "X-Proposify-Event": event,
        },
        body: payloadStr,
      });

      statusCode = response.status;
      responseText = await response.text();

      if (!response.ok) {
        errorMsg = `HTTP Error ${response.status}: ${responseText}`;
        console.error(`[Webhook Error] Failed dispatch to ${company.webhook_url}: Status ${response.status} - ${responseText}`);
      } else {
        console.log(`[Webhook] Successfully dispatched to ${company.webhook_url}`);
      }
    } catch (fetchErr: any) {
      errorMsg = fetchErr.message;
      console.error("[Webhook Error] Failed to fetch webhook endpoint:", fetchErr);
    }

    // Write log entry
    await logOutgoing(statusCode, responseText || null, errorMsg);
  } catch (err) {
    console.error("[Webhook Error] Critical failure in triggerWebhook:", err);
  }
}
