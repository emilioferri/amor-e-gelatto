# Guia de Publicação — Cloudflare Pages & Supabase (Custo $0/mês)

Este guia orienta o deploy completo da aplicação **Amor e Gelatto** em planos 100% gratuitos e permanentes.

---

## 🛠️ Visão Geral da Arquitetura

- **Front-end:** Cloudflare Pages Free (Tráfego e requisições ilimitadas, SSL automático, subdomínio `*.pages.dev`).
- **Banco & Backend:** Supabase Free (PostgreSQL com RLS, funções atômicas RPC e autenticação).
- **Repositório:** GitHub Free.
- **Canal de Pedidos:** WhatsApp Click-to-Chat (`wa.me`).

---

## 1. Configuração do Supabase (Banco de Dados Gratuito)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita.
2. Clique em **New Project**:
   - **Name:** `amor-e-gelatto`
   - **Database Password:** Defina uma senha forte e guarde-a com segurança.
   - **Region:** Selecione `South America (São Paulo)` para menor latência.
3. Após a criação do projeto, vá no menu **SQL Editor** (barra lateral esquerda):
   - Abra o arquivo [`supabase/schema.sql`](../supabase/schema.sql) deste projeto.
   - Copie todo o conteúdo, cole no SQL Editor do Supabase e clique em **Run** (Executar).
   - Isso criará todas as tabelas, índices, enumerações, dados iniciais e as stored procedures atômicas (`criar_pedido_com_reserva`, etc.).
4. Obtenha as chaves de API:
   - Vá em **Project Settings** (ícone de engrenagem) → **API**.
   - Copie o **Project URL** (Ex: `https://xyzabcdef.supabase.co`).
   - Copie a **anon / public key** (Chave pública do navegador).
   - ⚠️ **NUNCA copie nem divulgue a `service_role` key.**

---

## 2. Publicação no Cloudflare Pages

1. Crie uma conta gratuita no [cloudflare.com](https://dash.cloudflare.com).
2. No painel do Cloudflare, vá em **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**.
3. Selecione o repositório do GitHub onde você subiu os arquivos deste projeto.
4. Configure as opções de Build:
   - **Project Name:** `amor-e-gelatto` (ou nome de sua preferência).
   - **Production Branch:** `main`.
   - **Framework Preset:** `None` (Static HTML).
   - **Build Command:** Deixe em branco.
   - **Build Output Directory:** `/` (ou `.` para a raiz do projeto).
5. Clique em **Save and Deploy**. Em menos de 1 minuto seu site estará online no link `https://amor-e-gelatto.pages.dev`.

---

## 3. Conectar a Aplicação ao Supabase

Você pode conectar a URL e a Chave do Supabase de duas formas:

### Opção A — Pelo Painel Administrativo do Site (Mais Fácil)
1. Acesse seu site publicado no Cloudflare Pages (ex: `https://amor-e-gelatto.pages.dev/#admin`).
2. No topo do painel administrativo, clique em **Configurar Supabase**.
3. Cole o **Project URL** e a **anon key** do seu projeto Supabase.
4. O sistema salvará as credenciais e sincronizará os dados em tempo real.

### Opção B — Direto no arquivo `config.js`
1. Abra o arquivo [`config.js`](../config.js) no seu repositório.
2. Insira as variáveis diretamente:
   ```javascript
   SUPABASE_URL: 'https://seu-projeto.supabase.co',
   SUPABASE_ANON_KEY: 'sua-chave-anon-aqui',
   ```
3. Faça commit no GitHub; o Cloudflare Pages atualizará o site automaticamente.

---

## 4. Rotina de Manutenção do Supabase Free (Prevenção de Pausa)

> [!NOTE]
> No plano gratuito, o Supabase pausa automaticamente bancos de dados que ficarem **mais de 7 dias consecutivos sem nenhuma consulta ou acesso**.

### Como manter seu projeto sempre ativo sem custo:
1. **Acesso Semanal:** Basta acessar o painel administrativo ou abrir a loja uma vez por semana para gerar requisições e manter o banco ativo.
2. **Se o projeto for pausado:** O Supabase enviará um e-mail. Basta clicar em **Restore Project** no painel do Supabase e o banco voltará ao ar em menos de 2 minutos sem nenhuma perda de dados.
