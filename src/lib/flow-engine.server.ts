import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface FlowContext {
  proposal: any;
  client: any;
  payload?: any;
}

export async function executeFlow(
  companyId: string,
  triggerType: string,
  context: FlowContext
) {
  console.log(`[Flow Engine] Executing flow for trigger: ${triggerType}, company: ${companyId}`);

  try {
    // 1. Fetch active flow for this trigger
    const { data: flow, error: flowErr } = await supabaseAdmin
      .from("automation_flows")
      .select("*, companies(*)")
      .eq("company_id", companyId)
      .eq("trigger_type", triggerType)
      .eq("is_active", true)
      .maybeSingle();

    if (flowErr || !flow) {
      console.log(`[Flow Engine] No active flow found for trigger ${triggerType} and company ${companyId}`);
      return;
    }

    const company = (flow as any).companies;
    const steps = flow.steps as any;
    if (!steps || !Array.isArray(steps.nodes)) {
      console.log("[Flow Engine] Flow steps graph is empty or invalid. Skipping execution.");
      return;
    }

    const nodes = steps.nodes;
    const edges = steps.edges || [];

    // Find trigger node (source node)
    const triggerNode = nodes.find((n: any) => n.type === "trigger");
    if (!triggerNode) {
      console.log("[Flow Engine] No trigger node found in the graph. Skipping.");
      return;
    }

    // Traverse starting from trigger node
    let queue: { nodeId: string; sourceHandleId?: string }[] = edges
      .filter((e: any) => e.source === triggerNode.id)
      .map((e: any) => ({ nodeId: e.target, sourceHandleId: e.sourceHandle }));

    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      const node = nodes.find((n: any) => n.id === current.nodeId);
      if (!node) continue;

      console.log(`[Flow Engine] Processing node: ${node.id} (${node.type})`);

      if (node.type === "condition") {
        // Evaluate condition
        const { field, operator, value } = node.data || {};
        const proposalVal = context.proposal?.[field];

        let isTrue = false;
        if (field && operator) {
          const valStr = String(proposalVal || "");
          const compareStr = String(value || "");

          if (operator === "=") isTrue = valStr === compareStr;
          else if (operator === "!=") isTrue = valStr !== compareStr;
          else if (operator === ">") isTrue = Number(proposalVal) > Number(value);
          else if (operator === "<") isTrue = Number(proposalVal) < Number(value);
        }

        console.log(`[Flow Engine] Condition node ${node.id} evaluated to: ${isTrue}`);

        // Add matching edge targets to queue
        const targetHandle = isTrue ? "true" : "false";
        const outgoing = edges
          .filter((e: any) => e.source === node.id && e.sourceHandle === targetHandle)
          .map((e: any) => ({ nodeId: e.target, sourceHandleId: e.sourceHandle }));
        
        queue.push(...outgoing);
      } else if (node.type === "action") {
        // Execute Action
        const actionType = node.data?.action_type;
        console.log(`[Flow Engine] Executing Action: ${actionType}`);

        try {
          if (actionType === "email") {
            await handleEmailAction(node.data, context, company, flow.id);
          } else if (actionType === "webhook") {
            await handleWebhookAction(node.data, context, company, flow.id);
          }
        } catch (actErr: any) {
          console.error(`[Flow Engine] Action execution failed for node ${node.id}:`, actErr);
        }

        // Action completed, queue downstream connected nodes
        const outgoing = edges
          .filter((e: any) => e.source === node.id)
          .map((e: any) => ({ nodeId: e.target, sourceHandleId: e.sourceHandle }));
        
        queue.push(...outgoing);
      }
    }
  } catch (err: any) {
    console.error("[Flow Engine] Critical engine error:", err);
  }
}

// ----------------------------------------------------
// WEBHOOK DISPATCHER ACTION
// ----------------------------------------------------
async function handleWebhookAction(
  nodeData: any,
  context: FlowContext,
  company: any,
  flowId: string
) {
  const url = nodeData.url || company.webhook_url;
  if (!url) {
    throw new Error("No URL configured for Webhook action");
  }

  const payload = {
    event: "automation.webhook",
    proposal: context.proposal,
    client: context.client,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const secret = company.webhook_secret;
  if (secret) {
    const crypto = await import("crypto");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    headers["X-Proposify-Signature"] = hmac.digest("hex");
  }

  console.log(`[Flow Engine] Dispatched webhook to ${url}`);

  let statusCode = 0;
  let responseText = "";
  let errorMsg = null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    statusCode = res.status;
    responseText = await res.text();
  } catch (err: any) {
    statusCode = 500;
    errorMsg = err.message;
    responseText = "Network error";
  }

  // Register in integration_logs
  await supabaseAdmin.from("integration_logs").insert({
    company_id: company.id,
    flow_id: flowId,
    direction: "outgoing",
    event_type: `webhook.${nodeData.label || "action"}`,
    status_code: statusCode,
    payload: payload,
    response_body: responseText.slice(0, 2000),
    error_message: errorMsg,
  });
}

// ----------------------------------------------------
// SMTP EMAIL ACTION
// ----------------------------------------------------
async function handleEmailAction(
  nodeData: any,
  context: FlowContext,
  company: any,
  flowId: string
) {
  const toEmail = context.client?.email;
  if (!toEmail) {
    throw new Error("No recipient email found for Client");
  }

  const subjectTemplate = nodeData.email_subject || "Sua proposta comercial está pronta!";
  const bodyTemplate = nodeData.email_body || "Olá, segue link da proposta: {{proposal_url}}";

  const publicUrl = `https://proposifyai.lovable.app/proposta/${context.proposal?.proposal_code}`;
  
  // Interpolate templates
  const interpolate = (str: string) => {
    return str
      .replace(/\{\{proposal_code\}\}/g, context.proposal?.proposal_code || "")
      .replace(/\{\{proposal_url\}\}/g, publicUrl)
      .replace(/\{\{client_name\}\}/g, context.client?.name || "")
      .replace(/\{\{net_amount\}\}/g, String(context.proposal?.net_amount || 0));
  };

  const subject = interpolate(subjectTemplate);
  const bodyHtml = `
    <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333;">
      ${interpolate(bodyTemplate).replace(/\n/g, "<br />")}
    </div>
  `;

  let emailSent = false;
  let method = "";
  let errorMsg = null;

  if (company.smtp_host && company.smtp_port && company.smtp_user && company.smtp_pass) {
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
      method = "smtp";
    } catch (err: any) {
      errorMsg = err.message;
    }
  } else {
    // Resend fallback
    const resendApiKey = process.env['RESEND_API_KEY'] || process.env['VITE_RESEND_API_KEY'];
    if (resendApiKey) {
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

        if (response.ok) {
          emailSent = true;
          method = "resend";
        } else {
          errorMsg = await response.text();
        }
      } catch (err: any) {
        errorMsg = err.message;
      }
    }
  }

  // Register in logs
  await supabaseAdmin.from("integration_logs").insert({
    company_id: company.id,
    flow_id: flowId,
    direction: "outgoing",
    event_type: "email.dispatch",
    status_code: emailSent ? 250 : 500, // 250 is standard SMTP success code
    payload: {
      recipient: toEmail,
      subject,
      method_attempted: method || "none",
    },
    response_body: emailSent ? `Email sent successfully via ${method}` : "Failed sending email",
    error_message: errorMsg,
  });

  if (!emailSent) {
    throw new Error("Failed to send flow e-mail: " + (errorMsg || "SMTP settings missing"));
  }
}
