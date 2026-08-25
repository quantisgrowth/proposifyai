import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  companySettingsQuery,
  type PricingType,
  type PricingTier,
  type Company,
} from "@/lib/proposals";
import { brl, longDate, pricingLabel } from "@/lib/format";
import { CheckCircle, ShieldCheck, BarChart3 } from "lucide-react";

export type DocItem = {
  title: string;
  description?: string | null | undefined;
  pricing_type: PricingType;
  quantity: number;
  unit_price: number;
  original_price?: number | null | undefined;
  min_price?: number | null | undefined;
  max_price?: number | null | undefined;
  pricing_tiers?: PricingTier[] | null | undefined;
  pricing_tier_notes?: string | null | undefined;
  is_included?: boolean;
  total_price: number;
  // Tire B2B specifics snapshot
  modelo?: string | null | undefined;
  medida?: string | null | undefined;
  marca?: string | null | undefined;
  posicao?: string | null | undefined;
  lonas_pr?: number | null | undefined;
  profundidade_sulco_mm?: number | null | undefined;
  indice_carga_velocidade?: string | null | undefined;
  base_price_avista?: number | null | undefined;
  forma_pagamento?: string | null | undefined;
  condicao_escolhida?: string | null | undefined;
  taxa_percentual?: number | null | undefined;
  numero_parcelas?: number | null | undefined;
};

export type DocData = {
  code: string;
  clientName: string;
  clientDocument?: string | null | undefined;
  contactName?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  campaignName?: string | null | undefined;
  solutionName?: string | null | undefined;
  objectiveText?: string | null | undefined;
  scopeText?: string | null | undefined;
  fidelityPolicy?: string | null | undefined;
  nextStepsText?: string | null | undefined;
  items: DocItem[];
  total: number;
  discount: number;
  net: number;
  validityDate?: string | null | undefined;
  paymentTerms?: string | null | undefined;
  notes?: string | null | undefined;
  company?: Company | null | undefined;
  status?: string | null | undefined;
  acceptedAt?: string | null | undefined;
  acceptedByName?: string | null | undefined;
  acceptedByEmail?: string | null | undefined;
  acceptedByDocument?: string | null | undefined;
  acceptedByIp?: string | null | undefined;
  acceptedByUserAgent?: string | null | undefined;
  acceptedSignatureUrl?: string | null | undefined;
};

export function ProposalDocument({ data }: { data: DocData }) {
  const { data: settings } = useQuery(companySettingsQuery);
  const company = data.company ?? (settings as unknown as Company) ?? null;

  const companyName = company?.name || "Proposify AI";
  const companyLogo = company?.logo_url;
  const companyFooter =
    company?.footer_text ||
    `© ${new Date().getFullYear()} ${companyName} — ${company?.document || ""}`;

  const solutionName =
    data.solutionName ||
    company?.solution_name ||
    `${companyName} - Plataforma Inteligente de Gestão e Soluções`;

  const campaignName = data.campaignName || "Condições Exclusivas";
  const brandColor = company?.brand_color || "#0f172a";

  const objectiveText =
    data.objectiveText ||
    company?.objective_text ||
    `A presente proposta tem como objetivo apresentar as condições comerciais para a implementação da plataforma ${companyName}. Desenvolvido especificamente para solucionar os principais desafios do gerenciamento operacional, proporcionando controle em tempo real, redução de custos e alta eficiência de processos.`;

  const defaultScopeItems = [
    {
      title: "Aplicativo para Motoristas & Gestores",
      desc: "Permite a realização e o registro imediato de operações e pagamentos essenciais em rota.",
    },
    {
      title: "Painel de Gestão em Tempo Real",
      desc: "Visualização e acompanhamento instantâneo de cada transação realizada pelo time de rua.",
    },
    {
      title: "Filtros Avançados e Relatórios",
      desc: "Capacidade de auditar e exportar os gastos organizados por categorias de despesa, rotas e períodos.",
    },
    {
      title: "Usuários Ilimitados",
      desc: "Total liberdade para cadastrar quantos motoristas e gestores forem necessários, sem custos adicionais.",
    },
  ];

  const parsedScopeItems = useMemo(() => {
    const text = data.scopeText || company?.scope_text;
    if (!text) return defaultScopeItems;
    return text.split("\n").filter(l => l.trim()).map(line => {
      const idx = line.indexOf(":");
      if (idx !== -1) {
        return {
          title: line.substring(0, idx).trim(),
          desc: line.substring(idx + 1).trim()
        };
      }
      return {
        title: "",
        desc: line.trim()
      };
    });
  }, [data.scopeText, company?.scope_text]);

  // Identificar se há itens com tabela de faixas por volume
  const itemsWithTiers = data.items.filter(
    (i) => Array.isArray(i.pricing_tiers) && i.pricing_tiers.length > 0
  );

  const nextSteps = data.nextStepsText
    ? data.nextStepsText.split("\n").filter((l) => l.trim())
    : company?.next_steps_text
    ? company.next_steps_text.split("\n").filter((l) => l.trim())
    : [
        "Validação e aceite desta proposta comercial.",
        "Reunião de alinhamento técnico para parametrização inicial.",
        "Liberação do ambiente Web e envio dos acessos aos usuários.",
        "Agendamento do treinamento guiado com o time operacional (Onboarding).",
      ];

  const fidelityText =
    data.fidelityPolicy ||
    company?.fidelity_policy ||
    `A ${companyName} não impõe cláusulas de fidelidade contratual ou carência de permanência mínima. A nossa única fidelidade é a sua satisfação com a nossa ferramenta. O cliente mantém a parceria ativa enquanto a solução faz sentido e gera economia real para a operação.`;

  return (
    <article className="print-sheet mx-auto w-full max-w-3xl border border-border/80 bg-white text-slate-900 p-8 sm:p-14 shadow-xl rounded-xl space-y-10 font-sans">
      {/* 1. CABEÇALHO COM LOGO CENTRALIZADO */}
      <header className="flex flex-col items-center text-center pb-6 border-b border-slate-200">
        {companyLogo ? (
          <img
            src={companyLogo}
            alt={companyName}
            className="h-16 max-w-[220px] object-contain mb-4"
          />
        ) : (
          <div className="flex items-center gap-2 text-2xl font-bold text-slate-900 mb-4 tracking-tight">
            <span>{companyName}</span>
          </div>
        )}

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 uppercase">
          Proposta Comercial
        </h1>
      </header>

      {/* 2. METADADOS DA PROPOSTA */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm space-y-2 text-slate-700">
        <p>
          <strong className="text-slate-900 font-bold">Preparado para:</strong>{" "}
          {data.clientName || "—"}
        </p>
        {data.clientDocument ? (
          <p>
            <strong className="text-slate-900 font-bold">CNPJ:</strong> {data.clientDocument}
          </p>
        ) : null}
        <p>
          <strong className="text-slate-900 font-bold">Solução:</strong> {solutionName}
        </p>
        <p>
          <strong className="text-slate-900 font-bold">Campanha Especial:</strong> {campaignName}
        </p>
        <p>
          <strong className="text-slate-900 font-bold">Data de Emissão:</strong>{" "}
          {longDate(new Date().toISOString())}
        </p>
        {data.code ? (
          <p>
            <strong className="text-slate-900 font-bold">ID da Proposta:</strong>{" "}
            <span className="font-mono">{data.code}</span>
          </p>
        ) : null}
      </section>

      {/* 3. SEÇÃO 1: OBJETIVO E PROPOSTA DE VALOR */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: brandColor }}>
          1. Objetivo e Proposta de Valor
        </h2>
        <p className="text-sm leading-relaxed text-slate-700 text-justify whitespace-pre-line">
          {objectiveText}
        </p>
      </section>

      {/* 4. SEÇÃO 2: FUNCIONALIDADES & ESCOPO DA SOLUÇÃO */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: brandColor }}>
          2. Funcionalidades & Escopo da Solução
        </h2>
        <p className="text-sm text-slate-700">
          A contratação da plataforma engloba o acesso completo às seguintes ferramentas, sem
          qualquer restrição de recursos ou cobrança de licenças adicionais:
        </p>

        <div className="grid gap-3 pt-1">
          {parsedScopeItems.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
              <CheckCircle className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                {item.title ? (
                  <strong className="text-slate-900 font-semibold">{item.title}: </strong>
                ) : null}
                <span>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. SEÇÃO 3: TABELA DE PRECIFICAÇÃO POR PERFORMANCE / FAIXAS DE VOLUME (SE HOUVER) */}
      {itemsWithTiers.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: brandColor }}>
            <BarChart3 className="size-5 shrink-0" style={{ color: brandColor }} /> 3. Modelo de Precificação por Performance (Padrão)
          </h2>
          <p className="text-sm text-slate-700">
            A monetização do sistema dar-se-á por meio de performance transacional. A tabela é
            regressiva e calculada de forma consolidada ao final de cada período, baseando-se no
            volume total de movimentações:
          </p>

          {itemsWithTiers.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="text-white text-xs uppercase tracking-wider font-semibold" style={{ backgroundColor: brandColor }}>
                    <tr>
                      <th className="p-3.5 pl-4">Faixa de Volume (Transações/Mês)</th>
                      <th className="p-3.5 pr-4 text-right">Valor por Transação Realizada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(item.pricing_tiers ?? []).map((tier, tIdx) => (
                      <tr key={tIdx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 pl-4 font-medium text-slate-900">{tier.range}</td>
                        <td className="p-3.5 pr-4 text-right tabular-nums font-bold text-slate-900">
                          {brl(tier.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {item.pricing_tier_notes ? (
                <p className="text-xs text-slate-500 italic pl-1">
                  {item.pricing_tier_notes}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      )}

      {/* 6. SEÇÃO 4: CONDIÇÕES COMERCIAIS ESPECIAIS (TABELA DE ITENS) */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: brandColor }}>
          {itemsWithTiers.length > 0 ? "4." : "3."} Condições Comerciais Especiais ({campaignName})
        </h2>
        <p className="text-sm text-slate-700">
          Como benefício por nossa parceria durante a campanha <strong>{campaignName}</strong>,
          estruturamos uma oferta especial com condições exclusivas e barreira de entrada
          otimizada:
        </p>

        {/* Tabela de Condições Comerciais */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="text-white text-xs uppercase tracking-wider font-semibold" style={{ backgroundColor: brandColor }}>
              <tr>
                <th className="p-3.5 pl-4">Item do Serviço</th>
                <th className="p-3.5 text-center">Tipo de Cobrança</th>
                <th className="p-3.5 text-right">Preço de Tabela</th>
                <th className="p-3.5 pr-4 text-right">Condição Especial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    Nenhum item inserido na proposta.
                  </td>
                </tr>
              ) : (
                data.items.map((item, index) => {
                  const isTire = !!item.medida;
                  const isFree = item.unit_price === 0 || item.is_included;
                  const hasOriginal =
                    item.original_price && item.original_price > item.unit_price;

                  if (isTire) {
                    const priceAvista = Number(item.base_price_avista) || Number(item.unit_price) / (1 + (item.taxa_percentual || 0));
                    const costPerMm = item.profundidade_sulco_mm ? priceAvista / Number(item.profundidade_sulco_mm) : 0;
                    const installmentVal = Number(item.unit_price) / (item.numero_parcelas || 1);
                    const paymentLabel = item.forma_pagamento === "PIX_AVISTA" ? "PIX à Vista" : item.forma_pagamento === "BOLETO_PRAZO" ? "Boleto a Prazo" : item.forma_pagamento === "CARTAO_CREDITO" ? "Cartão de Crédito" : item.forma_pagamento || "A Prazo";
                    
                    return (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        <td colSpan={4} className="p-5 pl-4 align-top">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-3 border-b border-dashed border-slate-200">
                            <div>
                              <p className="text-base font-bold text-slate-900">
                                🚗 Pneu {item.marca} {item.modelo} — {item.medida} ({item.posicao})
                              </p>
                              <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5 font-medium">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">{item.lonas_pr} PR</span>
                                <span>•</span>
                                <span>Sulco: <strong className="text-slate-800">{item.profundidade_sulco_mm} mm</strong></span>
                                <span>•</span>
                                <span>Índice: <strong className="text-slate-800">{item.indice_carga_velocidade}</strong></span>
                                <span>•</span>
                                <span>Qtd: <strong className="text-slate-800">{item.quantity} un</strong></span>
                              </p>
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Valor Final no Prazo</p>
                              <p className="text-lg font-black text-slate-900">{brl(item.unit_price)} <span className="text-[11px] font-normal text-slate-500">/un</span></p>
                              <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-1.5 w-fit sm:ml-auto">
                                Plano B2B: {item.numero_parcelas || 1}x de {brl(installmentVal)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-3 grid gap-2.5 text-xs text-slate-700 sm:grid-cols-2">
                            <p>
                              <strong className="text-slate-900">Condição Comercial:</strong> {paymentLabel} - {item.condicao_escolhida || "PM30"} {item.taxa_percentual ? `(Taxa: ${(Number(item.taxa_percentual) * 100).toFixed(2)}%)` : ""}
                            </p>
                            <p className="text-slate-600 italic bg-slate-50 border border-slate-100 rounded-lg p-2.5 sm:col-span-2 leading-relaxed">
                              <strong className="text-emerald-700 not-italic block font-bold mb-0.5">💡 Diferencial Competitivo (LB Tyres):</strong>
                              Este pneu premium oferece carcaça reforçada de {item.lonas_pr} PR com alta recapabilidade e sulco de {item.profundidade_sulco_mm} mm original, apresentando um custo-benefício de apenas {brl(costPerMm)} por milímetro de borracha utilizável (preço base à vista de {brl(priceAvista)}). Um excelente investimento para redução do custo por quilômetro (CPK) da sua frota.
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 pl-4 align-top">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        {item.description ? (
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {item.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3.5 text-center text-xs text-slate-600 align-top whitespace-nowrap">
                        {pricingLabel[item.pricing_type] ?? item.pricing_type}
                      </td>
                      <td className="p-3.5 text-right tabular-nums text-slate-500 align-top whitespace-nowrap">
                        {hasOriginal ? (
                          <span className="line-through text-slate-400">
                            {brl(item.original_price!)}
                          </span>
                        ) : (
                          brl(item.unit_price)
                        )}
                      </td>
                      <td className="p-3.5 pr-4 text-right tabular-nums font-bold align-top whitespace-nowrap">
                        {isFree ? (
                          <span className="text-emerald-600 font-extrabold">R$ 0,00</span>
                        ) : (
                          <span className="text-slate-900">{brl(item.unit_price)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bloco de Totais */}
        <div className="ml-auto w-full max-w-xs space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="tabular-nums font-medium">{brl(data.total)}</span>
          </div>
          {data.discount > 0 ? (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Desconto Aplicado</span>
              <span className="tabular-nums">− {brl(data.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-slate-900">
            <span>Investimento Líquido</span>
            <span className="tabular-nums text-lg font-extrabold" style={{ color: brandColor }}>{brl(data.net)}</span>
          </div>
        </div>

        {/* Política de Fidelidade */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="size-4 shrink-0" style={{ color: brandColor }} /> Nossa Política de Fidelidade:
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{fidelityText}</p>
        </div>
      </section>

      {/* 7. SEÇÃO 5: PRÓXIMOS PASSOS PARA ATIVAÇÃO */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: brandColor }}>
          {itemsWithTiers.length > 0 ? "5." : "4."} Próximos Passos para Ativação
        </h2>
        <div className="space-y-2.5">
          {nextSteps.map((step, idx) => {
            const cleanStep = step.replace(/^\d+\.\s*/, "");
            return (
              <div key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: brandColor }}>
                  {idx + 1}
                </div>
                <p className="pt-0.5">{cleanStep}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. VALIDADE E ACEITE */}
      <section className="grid gap-6 border-t border-slate-200 pt-6 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
            Validade da Proposta
          </p>
          <p className="mt-1">
            Válida até {data.validityDate ? longDate(data.validityDate) : "15 dias após emissão"}.
          </p>
        </div>
        <div>
          <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
            Condição de Pagamento
          </p>
          <p className="mt-1">{data.paymentTerms || company?.default_payment_terms || "Pix / Boleto"}</p>
        </div>
      </section>

      {/* Recibo de Assinatura Digital e Auditoria se estiver aceita */}
      {data.status === "accepted" && (
        <section className="border-t-2 border-dashed border-slate-300 pt-6 mt-8 space-y-4 text-left">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-500" />
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
              Recibo de Assinatura e Aceite Digital
            </h3>
          </div>
          <div className="grid gap-6 sm:grid-cols-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-[11px] text-slate-700">
            <div className="sm:col-span-2 space-y-1.5">
              <p>
                <strong className="text-slate-900">Signatário:</strong> {data.acceptedByName || "—"}
              </p>
              <p>
                <strong className="text-slate-900">E-mail:</strong> {data.acceptedByEmail || "—"}
              </p>
              <p>
                <strong className="text-slate-900">CPF/CNPJ:</strong> {data.acceptedByDocument || "—"}
              </p>
              <p>
                <strong className="text-slate-900">IP de Registro:</strong> {data.acceptedByIp || "—"}
              </p>
              <p>
                <strong className="text-slate-900">Data/Hora:</strong> {data.acceptedAt ? new Date(data.acceptedAt).toLocaleString("pt-BR") : "—"}
              </p>
              <p className="text-[9px] text-slate-500 leading-snug">
                <strong className="text-slate-600">Navegador:</strong> {data.acceptedByUserAgent || "—"}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-white rounded p-2 h-24">
              {data.acceptedSignatureUrl ? (
                <>
                  <img
                    src={data.acceptedSignatureUrl}
                    alt="Assinatura"
                    className="max-h-14 max-w-full object-contain mb-1"
                  />
                  <span className="text-[8px] text-slate-400 uppercase tracking-widest font-semibold font-sans">
                    Assinatura Visual
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-slate-400 italic font-sans">Sem assinatura visual</span>
              )}
            </div>
          </div>
          <p className="text-[9px] text-slate-400 text-center italic leading-normal">
            Este documento foi aceito eletronicamente de acordo com os termos de consentimento digital estabelecidos.
          </p>
        </section>
      )}

      {/* 9. RODAPÉ OFICIAL DA EMPRESA (INDIVIDUAL) */}
      <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p className="font-medium">{companyFooter}</p>
      </footer>
    </article>
  );
}
