# Lista de Tarefas: Motor de Precificação de Pneus B2B (LB Tyres)

- [x] Executar Migration SQL para criar os novos campos em `products` e `proposal_items` (Migração salva em `supabase/migrations/20260825203000_add_tire_fields.sql`)
- [x] Atualizar tipos TypeScript em `src/lib/proposals.ts`
- [x] Modificar cadastro de produtos (`produtos.tsx`) para incluir campos de pneus se a empresa for LB Tyres
- [x] Modificar editor de propostas (`proposal-editor.tsx`) para processar pneu e regras financeiras dinâmicas
- [x] Modificar visualizador de propostas (`proposal-document.tsx`) para renderizar pneu e diferencial competitivo executivo
- [x] Atualizar endpoint de API (`api.v1.proposals.ts`) para suportar importação automatizada com `tire_item` e `financial_rules`
- [x] Validar compilação do projeto e testar as implementações
