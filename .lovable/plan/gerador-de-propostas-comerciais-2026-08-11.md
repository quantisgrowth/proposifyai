# Gerador de Propostas Comerciais

A minimal, Apple-inspired proposal builder for a sales team, in Portuguese, backed by Lovable Cloud (database included) with seeded demo data so everything works immediately.

## Screens

**Top bar (all pages)** — thin header with wordmark and tabs: Propostas, Nova Proposta, Produtos/Serviços, Clientes. Below it a quiet metrics strip: propostas enviadas, taxa de conversão, valor pendente.

**Propostas** (`/`) — table with ID, Cliente, Valor Total, Data de Envio, Validade and a status badge (Rascunho, Enviada, Aceita, Recusada, Expirada). Row menu: Visualizar, Editar, Baixar PDF, Duplicar, Alterar Status. Search + status filter.

**Nova Proposta** (`/nova`) — three steps on the left, live preview of the document on the right (tabbed on mobile):
1. Cliente — pick an existing client or add one inline (Razão Social/Nome, CNPJ/CPF, contato, e-mail, telefone).
2. Escopo — add line items from the product catalog or free-form; each has título, descrição, tipo (Recorrente/Pontual/Setup), quantidade, preço unitário. Running totals with discount in % or R$.
3. Condições — validade (7/15/30 dias ou data), pagamento (Pix, Boleto, Cartão, Parcelado), observações/cláusulas.
Save as Rascunho or Enviar.

**Proposta** (`/proposta/$code`) — the printable document: cabeçalho da empresa, bloco do cliente, tabela de serviços agrupada por tipo, resumo financeiro (subtotal, desconto, total), aviso de validade, área de aceite. Buttons: Exportar PDF (print stylesheet) and Copiar Link da Proposta. Publicly viewable by code.

**Produtos/Serviços** and **Clientes** — simple list + create/edit/deactivate.

## Design

Off-white canvas, near-black ink, one restrained accent; hairline borders instead of heavy shadows; tight tracking on headings; generous whitespace; 150ms transitions. Dark mode included. Currency and dates formatted pt-BR.

## Technical notes

- Lovable Cloud tables: `clients`, `products`, `proposals` (proposal_code, totals, validity_date, payment_terms, status), `proposal_items` — with grants and RLS. Reads/writes go through server functions; the public proposal view uses a narrow anon-readable path by proposal_code.
- Seed migration inserts demo clients, a product catalog and several proposals across all statuses.
- Routes: `/`, `/nova`, `/proposta/$code`, `/produtos`, `/clientes`; each with its own head metadata.
- PDF export via a dedicated print stylesheet (no extra library) so output stays crisp.

## Open choice

No login is planned — the app is open to anyone with the URL, and the proposal link is public by design. Say the word if you want sign-in for the team area.
