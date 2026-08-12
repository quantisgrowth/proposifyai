import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { clientsQuery } from "@/lib/proposals";
import { shortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Proposify AI" },
      {
        name: "description",
        content:
          "Base de clientes com razão social, CNPJ/CPF, contato, e-mail e telefone para preencher propostas em segundos.",
      },
      { property: "og:title", content: "Clientes — Proposify AI" },
      {
        property: "og:description",
        content: "Cadastro de clientes usado nas propostas comerciais.",
      },
    ],
  }),
  component: ClientsPage,
});

const empty = { name: "", document: "", contact_name: "", email: "", phone: "" };

function ClientsPage() {
  const qc = useQueryClient();
  const { profile, company } = useAuth();
  const companyId = profile?.company_id || company?.id || null;

  const { data } = useQuery(clientsQuery(companyId));
  const [form, setForm] = useState(empty);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe a razão social ou nome");
      const { error } = await supabase.from("clients").insert({
        ...form,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setForm(empty);
      toast.success("Cliente cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Clientes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Clientes vinculados à sua empresa para emissão de propostas.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3 font-normal">Cliente</th>
                <th className="px-4 py-3 font-normal">Documento</th>
                <th className="px-4 py-3 font-normal">Contato</th>
                <th className="px-4 py-3 font-normal">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.document}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.contact_name}
                    <span className="block text-xs">
                      {c.email} · {c.phone}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {shortDate(c.created_at)}
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum cliente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="font-medium text-foreground">Novo cliente</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Adicione para poder selecioná-lo ao gerar propostas.
          </p>

          <div className="mt-5 space-y-3.5">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Razão social / Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: ACME Corp"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">CNPJ / CPF</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Nome do contato</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="joao@acme.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <Button
              className="w-full mt-2"
              onClick={() => create.mutate()}
              disabled={create.isPending}
            >
              Cadastrar cliente
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
