# Registro de Ferramentas e Recursos Ativos — Amor e Gelatto

Documento de rastreabilidade de recursos, padrões e ferramentas ativas no projeto.

## Recursos Aprovados

| Recurso | Tipo | Origem/Referência | Finalidade | Data de Inclusão | Forma de Remoção |
|---|---|---|---|---|---|
| **Cloudflare Pages SPA Architecture** | Padrão arquitetural / Hospedagem | Cloudflare Pages Free (`_redirects`, `_headers`) | Hospedagem com custo mensal zero, tráfego ilimitado, SSL automático, roteamento SPA sem erro 404 e headers de segurança HTTP. | 2026-09-20 | Excluir arquivos `_redirects` e `_headers`. |
| **Supabase Client & Auth (v2 ESM/CDN)** | Biblioteca/dependência | `@supabase/supabase-js` v2 via CDN / Config segura | Conexão com banco de dados PostgreSQL do Supabase, autenticação e execução de procedures transacionais (`RPC`). | 2026-09-20 | Remover script do `index.html` e `config.js`. |
| **Vanilla Web Reactive Engine & Local Fallback** | Padrão arquitetural | HTML5 / CSS3 Tokens / Vanilla JS ES6+ | Execução imediata no navegador com zero dependências de build local, suporte offline e persistência segura. | 2026-09-20 | Substituir por framework com bundler se desejado. |
| **Schema SQL & Procedures Atômicas (PostgreSQL)** | Padrão arquitetural | `supabase/schema.sql` (Transações atômicas `FOR UPDATE` + RLS) | Controle rigoroso de estoque, reserva Pix por 15 min com contagem regressiva, cancelamento com devolução atômica e proteção de dados com RLS. | 2026-09-20 | Excluir script `supabase/schema.sql`. |
