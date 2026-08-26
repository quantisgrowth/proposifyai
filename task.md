# Lista de Tarefas — Perfis de Acesso Multi-Tenant & Dashboard SaaS

- [x] Criar migração SQL para atualizar perfis e RLS (role 'gestor')
- [x] Atualizar tipos no front-end (`proposals.ts`) e o `auth-context.tsx` para expor `isGestor`
- [x] Implementar filtros e restrições de navegação em `app-shell.tsx` baseados nas permissões
- [x] Desenvolver o Dashboard SaaS com indicadores de MRR e Gráficos de receita recorrente para o Super Admin em `dashboard.tsx`
- [x] Adaptar `clientes.tsx` para Super Admins visualizarem Empresas Assinantes com Drawer de detalhes (colaboradores e propostas)
- [x] Ajustar `admin.tsx` para Gestores visualizarem e criarem colaboradores limitados à própria empresa
- [x] Testar compilação e validar funcionamento do isolamento
