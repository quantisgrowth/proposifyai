import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { ProposalEditor } from "@/components/proposal-editor";

type Search = { edit?: string };

export const Route = createFileRoute("/_authenticated/nova")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    edit: typeof search['edit'] === "string" ? search['edit'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nova Proposta Comercial — Proposify AI" },
      {
        name: "description",
        content: "Crie propostas comerciais estruturadas com catálogo e condições especiais.",
      },
    ],
  }),
  component: NewProposalPage,
});

function NewProposalPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/nova" });

  return (
    <AppShell>
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {search.edit ? `Editar Proposta ${search.edit}` : "Nova Proposta Comercial"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie propostas personalizadas com a identidade oficial da sua empresa.
          </p>
        </div>
      </div>

      <div className="mt-6 flex-1 flex flex-col min-h-0">
        <ProposalEditor
          proposalCode={search.edit}
          onSaveSuccess={() => navigate({ to: "/" })}
          onCancel={() => navigate({ to: "/" })}
        />
      </div>
    </AppShell>
  );
}
