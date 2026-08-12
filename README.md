# Proposify AI

Create a high-end, minimalist, and responsive "Commercial Proposal Generator" web application designed for a sales team. The UI must follow a clean, modern aesthetic (Apple-inspired / Luxury Tech style) with subtle borders, refined typography, smooth transitions, and high contrast for dark/light elements.

### Core Architecture & Tech Stack:

- Frontend: React + Tailwind CSS + Lucide Icons + Shadcn UI components.

- Database & Backend: Supabase ready (define clean schemas for clients, products, proposals, and proposal_items).

### Key Application Layout & Features:

1. Dashboard / Navigation Header:

   - Clean top bar with navigation tabs: "Propostas", "Nova Proposta", "Produtos/Serviços", "Clientes".

   - Minimalist metrics bar at the top showing total proposals sent, conversion rate, and pending value.

2. "Nova Proposta" (Interactive Multi-step / Dynamic Form):

   - Step 1: Informações do Cliente

     - Fields: Razão Social/Nome, CNPJ/CPF, Nome do Contato, E-mail, Telefone/WhatsApp.

     - Select existing client from dropdown or quick-add new client inline.

   - Step 2: Escopo e Produtos/Serviços

     - Add dynamic line items from a pre-defined catalog.

     - For each item: Service Name, Description, Pricing Type (Recorrente / Pontual / Setup), Quantity, and Unit Price.

     - Real-time total calculation with discount application (% or fixed value).

   - Step 3: Condições Comerciais & Validade

     - Validity date selector (e.g., 7, 15, 30 days).

     - Payment terms selector (Pix, Boleto, Cartão de Crédito, Parcelado).

     - Custom notes / special clauses text area.

   - Live Preview Panel:

     - Side-by-side or tabbed real-time preview of the generated proposal visual layout before finalizing.

3. "Proposal Output / Visual Layout":

   - Elegant, printable / PDF-ready proposal document template.

   - Includes company header, structured client info block, formatted table of services, financial summary breakdown, validity notice, and acceptance call-to-action area.

   - Add a "Exportar PDF" button (using browser print / html2pdf formatting) and a "Copiar Link da Proposta" action.

4. "Propostas" (Management Table / Pipeline):

   - Table displaying all proposals with columns: ID, Cliente, Valor Total, Data de Envio, Validade, and Status Badge (`Rascunho`, `Enviada`, `Aceita`, `Recusada`, `Expirada`).

   - Quick action menu per proposal: "Visualizar", "Editar", "Baixar PDF", "Duplicar", "Alterar Status".

### Database Schema Requirements (Supabase Integration Ready):

- `clients`: id, name, document, email, phone, created_at

- `products`: id, name, description, unit_price, pricing_type (recurring, one_time, setup), active

- `proposals`: id, proposal_code, client_id, total_amount, discount_amount, net_amount, validity_date, payment_terms, notes, status, created_at

- `proposal_items`: id, proposal_id, product_id, title, description, quantity, unit_price, total_price

Ensure mock data is pre-populated for clients, products, and existing proposals so the interface can be fully tested out of the box. Focus on pixel-perfect alignment, subtle card shadows, crisp typography, and fluid state management.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://proposifyai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/40a0ba0e-c5ac-4986-8f95-38f931c22704).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
