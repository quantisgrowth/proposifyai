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
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          1. Objetivo e Proposta de Valor
        </h2>
        <p className="text-sm leading-relaxed text-slate-700 text-justify whitespace-pre-line">
          {objectiveText}
        </p>
      </section>

      {/* 4. SEÇÃO 2: FUNCIONALIDADES & ESCOPO DA SOLUÇÃO */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
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
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" /> 3. Modelo de Precificação por Performance (Padrão)
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
                  <thead className="bg-slate-900 text-white text-xs uppercase tracking-wider font-semibold">
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
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
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
            <thead className="bg-slate-900 text-white text-xs uppercase tracking-wider font-semibold">
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
                  const isFree = item.unit_price === 0 || item.is_included;
                  const hasOriginal =
                    item.original_price && item.original_price > item.unit_price;

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
            <span className="tabular-nums text-lg text-emerald-700">{brl(data.net)}</span>
          </div>
        </div>

        {/* Política de Fidelidade */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary" /> Nossa Política de Fidelidade:
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{fidelityText}</p>
        </div>
      </section>

      {/* 7. SEÇÃO 5: PRÓXIMOS PASSOS PARA ATIVAÇÃO */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          {itemsWithTiers.length > 0 ? "5." : "4."} Próximos Passos para Ativação
        </h2>
        <div className="space-y-2.5">
          {nextSteps.map((step, idx) => {
            const cleanStep = step.replace(/^\d+\.\s*/, "");
            return (
              <div key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
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

      {/* 9. RODAPÉ OFICIAL DA EMPRESA (INDIVIDUAL) */}
      <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p className="font-medium">{companyFooter}</p>
      </footer>
    </article>
  );
}
