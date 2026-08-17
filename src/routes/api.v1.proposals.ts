import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/v1/proposals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Authenticate with Bearer API Key
          const authHeader = request.headers.get("Authorization");
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(
              JSON.stringify({ error: "Missing or invalid Authorization header" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          const token = authHeader.replace("Bearer ", "").trim();
          
          // 2. Fetch corresponding company
          const { data: company, error: compErr } = await supabaseAdmin
            .from("companies")
            .select("*")
            .eq("api_key", token)
            .maybeSingle();

          if (compErr || !company) {
            return new Response(
              JSON.stringify({ error: "Unauthorized: Invalid API Key" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          // 3. Parse and validate payload
          const body = await request.json();
          if (!body.client || !body.client.name) {
            return new Response(
              JSON.stringify({ error: "Validation error: 'client.name' is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // 4. Handle Client Creation / Fetching
          let clientId = "";
          let clientDocument = body.client.document ? body.client.document.replace(/\D/g, "") : null;

          if (clientDocument) {
            const { data: existingClient } = await supabaseAdmin
              .from("clients")
              .select("id")
              .eq("company_id", company.id)
              .eq("document", clientDocument)
              .maybeSingle();
            
            if (existingClient) {
              clientId = existingClient.id;
            }
          }

          if (!clientId) {
            const { data: newClient, error: clientErr } = await supabaseAdmin
              .from("clients")
              .insert({
                company_id: company.id,
                name: body.client.name.trim(),
                document: clientDocument,
                email: body.client.email?.trim() || null,
                phone: body.client.phone?.trim() || null,
                contact_name: body.client.contact_name?.trim() || null,
              })
              .select("id")
              .single();

            if (clientErr) {
              return new Response(
                JSON.stringify({ error: "Failed to create client: " + clientErr.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              );
            }
            clientId = newClient.id;
          }

          // 5. Calculate default validity date
          const validityDays = company.default_validity_days || 15;
          const validity = new Date();
          validity.setDate(validity.getDate() + validityDays);
          const defaultValidityDate = validity.toISOString().split("T")[0];

          // 6. Generate next proposal code
          const year = new Date().getFullYear();
          const { data: lastProposal } = await supabaseAdmin
            .from("proposals")
            .select("proposal_code")
            .like("proposal_code", `PRP-${year}-%`)
            .order("proposal_code", { ascending: false })
            .limit(1);
          
          const lastCode = lastProposal?.[0]?.proposal_code;
          const num = lastCode ? parseInt(lastCode.split("-")[2] ?? "0", 10) + 1 : 1;
          const proposalCode = `PRP-${year}-${String(num).padStart(4, "0")}`;

          // 7. Calculate amounts based on optional items list
          let subtotal = 0;
          const itemsPayload = Array.isArray(body.items) ? body.items : [];
          
          itemsPayload.forEach((item: any) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unit_price) || 0;
            subtotal += qty * price;
          });

          const discount = Number(body.discount_amount) || 0;
          const net = Math.max(0, subtotal - discount);

          // 8. Insert Proposal
          const { data: proposal, error: propErr } = await supabaseAdmin
            .from("proposals")
            .insert({
              company_id: company.id,
              client_id: clientId,
              proposal_code: proposalCode,
              campaign_name: body.campaign_name?.trim() || "Importado do CRM",
              solution_name: body.solution_name?.trim() || company.solution_name || "Proposta Comercial",
              objective_text: body.objective_text?.trim() || company.objective_text || null,
              scope_text: body.scope_text?.trim() || company.scope_text || null,
              fidelity_policy: body.fidelity_policy?.trim() || company.fidelity_policy || null,
              next_steps_text: body.next_steps_text?.trim() || company.next_steps_text || null,
              total_amount: subtotal,
              discount_amount: discount,
              net_amount: net,
              validity_date: body.validity_date || defaultValidityDate,
              payment_terms: body.payment_terms || company.default_payment_terms || "Pix",
              notes: body.notes?.trim() || null,
              status: "draft",
            })
            .select("*")
            .single();

          if (propErr) {
            return new Response(
              JSON.stringify({ error: "Failed to create proposal: " + propErr.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          // 9. Insert items if any
          if (itemsPayload.length > 0) {
            const itemsData = itemsPayload.map((item: any, idx: number) => ({
              proposal_id: proposal.id,
              title: item.title?.trim() || "Item",
              description: item.description?.trim() || null,
              quantity: Number(item.quantity) || 1,
              unit_price: Number(item.unit_price) || 0,
              total_price: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
              pricing_type: item.pricing_type || "one_time",
              position: idx,
              is_included: true,
            }));

            const { error: itemsErr } = await supabaseAdmin
              .from("proposal_items")
              .insert(itemsData);

            if (itemsErr) {
              // Non-blocking but return warning
              return new Response(
                JSON.stringify({
                  success: true,
                  warning: "Proposal created but failed to import items: " + itemsErr.message,
                  proposal_id: proposal.id,
                  proposal_code: proposal.proposal_code,
                  edit_url: `/propostas?edit=${proposal.proposal_code}`,
                }),
                { status: 201, headers: { "Content-Type": "application/json" } }
              );
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              proposal_id: proposal.id,
              proposal_code: proposal.proposal_code,
              edit_url: `/propostas?edit=${proposal.proposal_code}`,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: "Internal server error: " + err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
