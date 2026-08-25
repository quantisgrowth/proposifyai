# Lista de Tarefas — Fase 1: Importador/Exportador de Produtos & Índices de Performance

- [x] Criar migração SQL para adicionar índices compostos nas tabelas `products`, `proposals` e `clients` (Salvo em `supabase/migrations/20260825205000_add_performance_indexes.sql`)
- [x] Adicionar botões "Importar Planilha" e "Exportar Planilha" na tela de Catálogo (`produtos.tsx`)
- [x] Desenvolver modal de importação com opção de download de planilha modelo CSV
- [x] Implementar parser client-side de CSV com suporte a separadores comuns (vírgula e ponto-e-vírgula)
- [x] Criar visualizador de preview com tabela de validação (identificar pneus válidos, erros ou campos faltantes)
- [x] Implementar inserção em lote (`bulk insert`) no Supabase dos produtos validados
- [x] Implementar função de exportação que compila todos os produtos da empresa em CSV e faz o download
- [x] Testar e compilar o projeto para garantir integridade
