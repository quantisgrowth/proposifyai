import { COMPANY, type PricingType } from "@/lib/proposals";
import { brl, longDate, pricingLabel } from "@/lib/format";

export type DocItem = {
  title: string;
  description?: string | null | undefined;
  pricing_type: PricingType;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type DocData = {
  code: string;
  clientName: string;
  clientDocument?: string | null | undefined;
  contactName?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  items: DocItem[];
  total: number;
  discount: number;
  net: number;
  validityDate?: string | null | undefined;
  paymentTerms?: string | null | undefined;
  notes?: string | null | undefined;
};

export function ProposalDocument({ data }: { data: DocData }) {
  const recurring = data.items
    .filter((i) => i.pricing_type === "recurring")
    .reduce((s, i) => s + i.total_price, 0);

  return (
    <article className="print-sheet mx-auto w-full max-w-3xl border border-border bg-card p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-8">
        <div className="min-w-0">
          <p className="font-serif text-2xl tracking-tight">{COMPANY.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{COMPANY.tagline}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {COMPANY.document} · {COMPANY.email} · {COMPANY.phone}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Proposta</p>
          <p className="text-sm font-medium tabular-nums">{data.code}</p>
        </div>
      </header>

      <section className="grid gap-6 border-b border-border py-8 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Cliente</p>
          <p className="mt-2 text-base font-medium">{data.clientName || "—"}</p>
          {data.clientDocument ? (
            <p className="text-sm text-muted-foreground">{data.clientDocument}</p>
          ) : null}
        </div>
        <div className="text-sm text-muted-foreground sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.16em]">Contato</p>
          <p className="mt-2 text-foreground">{data.contactName || "—"}</p>
          <p>{data.email || ""}</p>
          <p>{data.phone || ""}</p>
        </div>
      </section>

      <section className="py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Escopo</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="pb-2 font-normal">Serviço</th>
              <th className="pb-2 text-center font-normal">Tipo</th>
              <th className="pb-2 text-center font-normal">Qtd.</th>
              <th className="pb-2 text-right font-normal">Unitário</th>
              <th className="pb-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  Nenhum item adicionado ainda.
                </td>
              </tr>
            ) : (
              data.items.map((item, index) => (
                <tr key={index} className="border-b border-border/70 align-top">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{item.title}</p>
                    {item.description ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 text-center text-xs text-muted-foreground">
                    {pricingLabel[item.pricing_type] ?? item.pricing_type}
                  </td>
                  <td className="py-3 text-center tabular-nums">{item.quantity}</td>
                  <td className="py-3 text-right tabular-nums">{brl(item.unit_price)}</td>
                  <td className="py-3 text-right tabular-nums">{brl(item.total_price)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="ml-auto w-full max-w-xs space-y-2 border-t border-border pt-6 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{brl(data.total)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Desconto</span>
          <span className="tabular-nums">− {brl(data.discount)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
          <span>Total</span>
          <span className="tabular-nums">{brl(data.net)}</span>
        </div>
        {recurring > 0 ? (
          <p className="text-right text-xs text-muted-foreground">
            Inclui {brl(recurring)} em serviços recorrentes mensais.
          </p>
        ) : null}
      </section>

      <section className="mt-10 grid gap-6 border-t border-border pt-8 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Validade</p>
          <p className="mt-2">Proposta válida até {longDate(data.validityDate)}.</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pagamento</p>
          <p className="mt-2">{data.paymentTerms || "A combinar"}</p>
        </div>
        {data.notes ? (
          <div className="sm:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Observações
            </p>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">
              {data.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-10 border border-border bg-secondary/60 p-6">
        <p className="font-serif text-lg">Aceite da proposta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ao assinar abaixo, o cliente concorda com o escopo e as condições descritas neste
          documento.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div className="border-t border-foreground/30 pt-2 text-xs text-muted-foreground">
            {data.contactName || "Cliente"} — {data.clientName || ""}
          </div>
          <div className="border-t border-foreground/30 pt-2 text-xs text-muted-foreground">
            {COMPANY.name}
          </div>
        </div>
      </section>
    </article>
  );
}
