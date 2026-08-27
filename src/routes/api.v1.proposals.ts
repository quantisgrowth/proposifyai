import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/v1/proposals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

          // 3. Fetch proposals with client info and items
          const { data: proposals, error: propErr } = await supabaseAdmin
            .from("proposals")
            .select(`
              id,
              proposal_code,
              campaign_name,
              solution_name,
              total_amount,
              discount_amount,
              net_amount,
              validity_date,
              status,
              created_at,
              payment_terms,
              notes,
              clients (
                id,
                name,
                document,
                email,
                phone,
                contact_name
              ),
              proposal_items (
                id,
                title,
                description,
                quantity,
                unit_price,
                total_price
              )
            `)
            .eq("company_id", company.id)
            .order("created_at", { ascending: false });

          if (propErr) {
            return new Response(
              JSON.stringify({ error: "Failed to fetch proposals: " + propErr.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(JSON.stringify({ success: true, proposals }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: "Internal server error: " + err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
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

          // Helper to get nested value by path (e.g. "client.name")
          const getValueByPath = (obj: any, path: string | null | undefined): any => {
            if (!path) return undefined;
            return path.split('.').reduce((acc, part) => acc && acc[part], obj);
          };

          // Helper to log integration
          const logIntegration = async (params: {
            flowId?: string | null | undefined;
            direction: 'incoming' | 'outgoing';
            eventType: string;
            statusCode: number;
            payload: any;
            responseBody: string;
            errorMessage?: string | null | undefined;
          }) => {
            try {
              await supabaseAdmin.from("integration_logs").insert({
                company_id: company.id,
                flow_id: params.flowId || null,
                direction: params.direction,
                event_type: params.eventType,
                status_code: params.statusCode,
                payload: params.payload,
                response_body: params.responseBody,
                error_message: params.errorMessage || null
              });
            } catch (logErr) {
              console.error("[Log Integration Error]:", logErr);
            }
          };

          // Fetch active automation flow for incoming proposal
          const { data: activeFlow } = await supabaseAdmin
            .from("automation_flows")
            .select("*")
            .eq("company_id", company.id)
            .eq("trigger_type", "crm.incoming_proposal")
            .eq("is_active", true)
            .maybeSingle();

          let clientName = body.client?.name;
          let clientEmail = body.client?.email;
          let clientDocument = body.client?.document;
          let clientPhone = body.client?.phone;
          let clientContactName = body.client?.contact_name;
          let campaignName = body.campaign_name;
          let solutionName = body.solution_name;
          let paymentTerms = body.payment_terms;
          let notes = body.notes;
          let itemsPayload = Array.isArray(body.items) ? body.items : [];
          let discount = Number(body.discount_amount) || 0;
          let validityDate = body.validity_date;

          if (activeFlow && activeFlow.mapping_rules) {
            const rules = activeFlow.mapping_rules as Record<string, string>;
            if (rules["client.name"]) clientName = getValueByPath(body, rules["client.name"]);
            if (rules["client.email"]) clientEmail = getValueByPath(body, rules["client.email"]);
            if (rules["client.document"]) clientDocument = getValueByPath(body, rules["client.document"]);
            if (rules["client.phone"]) clientPhone = getValueByPath(body, rules["client.phone"]);
            if (rules["client.contact_name"]) clientContactName = getValueByPath(body, rules["client.contact_name"]);
            if (rules["campaign_name"]) campaignName = getValueByPath(body, rules["campaign_name"]);
            if (rules["solution_name"]) solutionName = getValueByPath(body, rules["solution_name"]);
            if (rules["payment_terms"]) paymentTerms = getValueByPath(body, rules["payment_terms"]);
            if (rules["notes"]) notes = getValueByPath(body, rules["notes"]);
            if (rules["discount_amount"]) discount = Number(getValueByPath(body, rules["discount_amount"])) || 0;
            if (rules["validity_date"]) validityDate = getValueByPath(body, rules["validity_date"]);
            
            if (rules["items"]) {
              const itemsPath = getValueByPath(body, rules["items"]);
              if (Array.isArray(itemsPath)) {
                itemsPayload = itemsPath;
              }
            }
          }

          // Normalização para Pneus B2B (LB Tyres) caso venha no payload
          if (body.tire_item) {
            const tire = body.tire_item;
            const fin = body.financial_rules || {};

            const basePrice = Number(tire.base_price_avista) || 0;
            const taxa = Number(fin.taxa_percentual) || 0;
            const calculatedUnitPrice = Number((basePrice * (1 + taxa)).toFixed(2));
            const numParcelas = Number(fin.numero_parcelas) || 1;

            // Search or insert product in catalog
            const tireProductName = `${tire.marca} ${tire.modelo} - ${tire.medida}`;
            let productId = null;
            
            try {
              const { data: existingProd } = await supabaseAdmin
                .from("products")
                .select("id")
                .eq("company_id", company.id)
                .eq("name", tireProductName)
                .maybeSingle();

              if (existingProd) {
                productId = existingProd.id;
              } else {
                const { data: newProd } = await supabaseAdmin
                  .from("products")
                  .insert({
                    company_id: company.id,
                    name: tireProductName,
                    description: `Pneu B2B - ${tire.marca} ${tire.modelo} ${tire.medida} (${tire.posicao})`,
                    unit_price: calculatedUnitPrice,
                    pricing_type: "one_time",
                    modelo: tire.modelo || null,
                    medida: tire.medida || null,
                    marca: tire.marca || null,
                    posicao: tire.posicao || null,
                    lonas_pr: Number(tire.lonas_pr) || null,
                    profundidade_sulco_mm: Number(tire.profundidade_sulco_mm) || null,
                    indice_carga_velocidade: tire.indice_carga_velocidade || null,
                    base_price_avista: basePrice,
                    forma_pagamento: fin.forma_pagamento || null,
                    condicao_escolhida: fin.condicao_escolhida || null,
                    taxa_percentual: taxa,
                    numero_parcelas: numParcelas,
                  })
                  .select("id")
                  .single();
                if (newProd) productId = newProd.id;
              }
            } catch (dbErr) {
              console.error("[API Product Match/Insert Error]:", dbErr);
            }

            // Convert to itemsPayload format
            itemsPayload = [{
              product_id: productId,
              title: tireProductName,
              description: `Ficha Técnica: ${tire.lonas_pr || 16} PR | Sulco: ${tire.profundidade_sulco_mm || 15.0} mm | Índice: ${tire.indice_carga_velocidade || "—"}`,
              quantity: Number(body.quantity) || 1,
              unit_price: calculatedUnitPrice,
              base_price_avista: basePrice,
              forma_pagamento: fin.forma_pagamento || "PIX_AVISTA",
              condicao_escolhida: fin.condicao_escolhida || "PM30",
              taxa_percentual: taxa,
              numero_parcelas: numParcelas,
              modelo: tire.modelo || null,
              medida: tire.medida || null,
              marca: tire.marca || null,
              posicao: tire.posicao || null,
              lonas_pr: Number(tire.lonas_pr) || null,
              profundidade_sulco_mm: Number(tire.profundidade_sulco_mm) || null,
              indice_carga_velocidade: tire.indice_carga_velocidade || null,
            }];

            paymentTerms = `${fin.forma_pagamento || "PIX_AVISTA"} - ${fin.condicao_escolhida || "PM30"}`;
          }

          if (!clientName) {
            const errorMsg = "Validation error: 'client.name' is required (direct or mapped)";
            const resBody = JSON.stringify({ error: errorMsg });
            await logIntegration({
              flowId: activeFlow?.id,
              direction: 'incoming',
              eventType: 'crm.incoming_proposal',
              statusCode: 400,
              payload: body,
              responseBody: resBody,
              errorMessage: errorMsg
            });
            return new Response(resBody, { status: 400, headers: { "Content-Type": "application/json" } });
          }

          // 4. Handle Client Creation / Fetching
          let clientId = "";
          let clientDocumentClean = clientDocument ? String(clientDocument).replace(/\D/g, "") : null;

          if (clientDocumentClean) {
            const { data: existingClient } = await supabaseAdmin
              .from("clients")
              .select("id")
              .eq("company_id", company.id)
              .eq("document", clientDocumentClean)
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
                name: String(clientName).trim(),
                document: clientDocumentClean,
                email: clientEmail ? String(clientEmail).trim() : null,
                phone: clientPhone ? String(clientPhone).trim() : null,
                contact_name: clientContactName ? String(clientContactName).trim() : null,
              })
              .select("id")
              .single();

            if (clientErr) {
              const errorMsg = "Failed to create client: " + clientErr.message;
              const resBody = JSON.stringify({ error: errorMsg });
              await logIntegration({
                flowId: activeFlow?.id,
                direction: 'incoming',
                eventType: 'crm.incoming_proposal',
                statusCode: 500,
                payload: body,
                responseBody: resBody,
                errorMessage: errorMsg
              });
              return new Response(resBody, { status: 500, headers: { "Content-Type": "application/json" } });
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
          itemsPayload.forEach((item: any) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unit_price) || 0;
            subtotal += qty * price;
          });

          const net = Math.max(0, subtotal - discount);

          // 8. Insert Proposal
          const { data: proposal, error: propErr } = await supabaseAdmin
            .from("proposals")
            .insert({
              company_id: company.id,
              client_id: clientId,
              proposal_code: proposalCode,
              campaign_name: campaignName ? String(campaignName).trim() : "Importado do CRM",
              solution_name: solutionName ? String(solutionName).trim() : (company.solution_name || "Proposta Comercial"),
              objective_text: company.objective_text || null,
              scope_text: company.scope_text || null,
              fidelity_policy: company.fidelity_policy || null,
              next_steps_text: company.next_steps_text || null,
              total_amount: subtotal,
              discount_amount: discount,
              net_amount: net,
              validity_date: validityDate || defaultValidityDate,
              payment_terms: paymentTerms ? String(paymentTerms).trim() : (company.default_payment_terms || "Pix"),
              notes: notes ? String(notes).trim() : null,
              status: "draft",
            })
            .select("*")
            .single();

          if (propErr) {
            const errorMsg = "Failed to create proposal: " + propErr.message;
            const resBody = JSON.stringify({ error: errorMsg });
            await logIntegration({
              flowId: activeFlow?.id,
              direction: 'incoming',
              eventType: 'crm.incoming_proposal',
              statusCode: 500,
              payload: body,
              responseBody: resBody,
              errorMessage: errorMsg
            });
            return new Response(resBody, { status: 500, headers: { "Content-Type": "application/json" } });
          }

          // 9. Insert items if any
          if (itemsPayload.length > 0) {
            const itemsData = itemsPayload.map((item: any, idx: number) => ({
              proposal_id: proposal.id,
              product_id: item.product_id || null,
              title: item.title ? String(item.title).trim() : "Item",
              description: item.description ? String(item.description).trim() : null,
              quantity: Number(item.quantity) || 1,
              unit_price: Number(item.unit_price) || 0,
              total_price: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
              position: idx,
              is_included: true,
              // snapshot tire fields
              modelo: item.modelo || null,
              medida: item.medida || null,
              marca: item.marca || null,
              posicao: item.posicao || null,
              lonas_pr: item.lonas_pr ? Number(item.lonas_pr) : null,
              profundidade_sulco_mm: item.profundidade_sulco_mm ? Number(item.profundidade_sulco_mm) : null,
              indice_carga_velocidade: item.indice_carga_velocidade || null,
              base_price_avista: item.base_price_avista ? Number(item.base_price_avista) : null,
              forma_pagamento: item.forma_pagamento || null,
              condicao_escolhida: item.condicao_escolhida || null,
              taxa_percentual: item.taxa_percentual ? Number(item.taxa_percentual) : null,
              numero_parcelas: item.numero_parcelas ? Number(item.numero_parcelas) : null,
            }));

            const { error: itemsErr } = await supabaseAdmin
              .from("proposal_items")
              .insert(itemsData);

            if (itemsErr) {
              const resBody = JSON.stringify({
                success: true,
                warning: "Proposal created but failed to import items: " + itemsErr.message,
                proposal_id: proposal.id,
                proposal_code: proposal.proposal_code,
                edit_url: `/propostas?edit=${proposal.proposal_code}`,
              });
              await logIntegration({
                flowId: activeFlow?.id,
                direction: 'incoming',
                eventType: 'crm.incoming_proposal',
                statusCode: 201,
                payload: body,
                responseBody: resBody,
                errorMessage: "Partial Success: Item import failed"
              });
              return new Response(resBody, { status: 201, headers: { "Content-Type": "application/json" } });
            }
          }

          // Fetch full client record for flow execution
          const { data: client } = await supabaseAdmin
            .from("clients")
            .select("*")
            .eq("id", clientId)
            .maybeSingle();

          // Execute visual automation flow in background
          const { executeFlow } = await import("@/lib/flow-engine.server");
          executeFlow(company.id, "crm.incoming_proposal", {
            proposal,
            client,
            payload: body,
          }).catch(err => {
            console.error("[Flow Engine Error in API]:", err);
          });
 
          const resBodySuccess = JSON.stringify({
            success: true,
            proposal_id: proposal.id,
            proposal_code: proposal.proposal_code,
            edit_url: `/propostas?edit=${proposal.proposal_code}`,
          });

          await logIntegration({
            flowId: activeFlow?.id,
            direction: 'incoming',
            eventType: 'crm.incoming_proposal',
            statusCode: 201,
            payload: body,
            responseBody: resBodySuccess
          });

          return new Response(resBodySuccess, { status: 201, headers: { "Content-Type": "application/json" } });
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
