-- ============================================================================
-- AMOR E GELATTO — SCHEMA SQL ATUALIZADO (SUPABASE / POSTGRESQL)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Enum de Status de Pedido
DO $$ BEGIN
  CREATE TYPE status_pedido_enum AS ENUM (
    'aguardando_pagamento_pix',
    'pago',
    'confirmado_pagamento_na_entrega',
    'em_separacao',
    'saiu_para_entrega',
    'entregue',
    'cancelado',
    'expirado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tabela de Configuração da Loja
CREATE TABLE IF NOT EXISTS public.loja_config (
  id INT PRIMARY KEY DEFAULT 1,
  loja_aberta BOOLEAN NOT NULL DEFAULT true,
  mensagem_entrega TEXT NOT NULL DEFAULT 'Entregas imediatas nos blocos enquanto houver disponibilidade.',
  horarios_disponiveis JSONB NOT NULL DEFAULT '["Assim que possível (Imediato)", "Entre 13h e 14h", "Entre 14h e 15h", "Entre 15h e 16h", "Entre 16h e 17h", "Entre 17h e 18h", "Entre 18h e 19h", "Entre 19h e 20h", "Entre 20h e 21:30h"]'::jsonb,
  chave_pix TEXT NOT NULL DEFAULT 'pix@amorgelatto.com.br',
  tipo_chave_pix TEXT NOT NULL DEFAULT 'Chave E-mail',
  nome_titular_pix TEXT NOT NULL DEFAULT 'Amor e Gelatto Artesanal',
  duracao_reserva_pix_minutos INT NOT NULL DEFAULT 15,
  pix_ativo BOOLEAN NOT NULL DEFAULT true,
  dinheiro_ativo BOOLEAN NOT NULL DEFAULT true,
  cartao_entrega_ativo BOOLEAN NOT NULL DEFAULT true,
  telefone_whatsapp TEXT NOT NULL DEFAULT '5511987654321',
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 3. Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'Gelattos Artesanais',
  preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
  estoque INT NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  foto_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT DEFAULT 0,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_pedido SERIAL UNIQUE,
  nome_cliente TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  bloco TEXT NOT NULL,
  apartamento TEXT NOT NULL,
  horario_desejado TEXT NOT NULL DEFAULT 'Assim que possível',
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cartao_entrega')),
  status status_pedido_enum NOT NULL DEFAULT 'aguardando_pagamento_pix',
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  observacoes TEXT,
  expira_em TIMESTAMP WITH TIME ZONE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Itens do Pedido
CREATE TABLE IF NOT EXISTS public.itens_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  nome_produto TEXT NOT NULL,
  quantidade INT NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de Histórico de Mudanças de Status (Auditoria)
CREATE TABLE IF NOT EXISTS public.historico_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  status_anterior status_pedido_enum,
  status_novo status_pedido_enum NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.loja_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública de loja_config" ON public.loja_config;
CREATE POLICY "Permitir leitura pública de loja_config" ON public.loja_config
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir alteração de loja_config apenas para admin" ON public.loja_config;
CREATE POLICY "Permitir alteração de loja_config apenas para admin" ON public.loja_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura pública de produtos ativos" ON public.produtos;
CREATE POLICY "Permitir leitura pública de produtos ativos" ON public.produtos
  FOR SELECT TO anon, authenticated USING (ativo = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir gerenciamento de produtos apenas para admin" ON public.produtos;
CREATE POLICY "Permitir gerenciamento de produtos apenas para admin" ON public.produtos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso a pedidos apenas para admin" ON public.pedidos;
CREATE POLICY "Permitir acesso a pedidos apenas para admin" ON public.pedidos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso a itens de pedidos apenas para admin" ON public.itens_pedido;
CREATE POLICY "Permitir acesso a itens de pedidos apenas para admin" ON public.itens_pedido
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso a historico de pedidos apenas para admin" ON public.historico_status;
CREATE POLICY "Permitir acesso a historico de pedidos apenas para admin" ON public.historico_status
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- PROCEDURES ATÔMICAS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.criar_pedido_com_reserva(
  p_nome_cliente TEXT,
  p_whatsapp TEXT,
  p_bloco TEXT,
  p_apartamento TEXT,
  p_horario_desejado TEXT,
  p_forma_pagamento TEXT,
  p_observacoes TEXT,
  p_itens JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_item RECORD;
  v_produto RECORD;
  v_total NUMERIC(10, 2) := 0;
  v_subtotal NUMERIC(10, 2) := 0;
  v_pedido_id UUID;
  v_numero_pedido INT;
  v_status_inicial status_pedido_enum;
  v_expira_em TIMESTAMP WITH TIME ZONE := NULL;
  v_reserva_minutos INT;
BEGIN
  SELECT * INTO v_config FROM public.loja_config WHERE id = 1;
  IF NOT FOUND OR NOT v_config.loja_aberta THEN
    RAISE EXCEPTION 'A loja está fechada no momento. Novos pedidos não são aceitos.';
  END IF;

  IF p_forma_pagamento = 'pix' AND NOT v_config.pix_ativo THEN
    RAISE EXCEPTION 'Pagamento via Pix não está disponível nesta venda.';
  ELSIF p_forma_pagamento = 'dinheiro' AND NOT v_config.dinheiro_ativo THEN
    RAISE EXCEPTION 'Pagamento em dinheiro não está disponível nesta venda.';
  ELSIF p_forma_pagamento = 'cartao_entrega' AND NOT v_config.cartao_entrega_ativo THEN
    RAISE EXCEPTION 'Pagamento em cartão na entrega não está disponível nesta venda.';
  END IF;

  IF p_forma_pagamento = 'pix' THEN
    v_status_inicial := 'aguardando_pagamento_pix';
    v_reserva_minutos := COALESCE(v_config.duracao_reserva_pix_minutos, 15);
    v_expira_em := NOW() + (v_reserva_minutos || ' minutes')::INTERVAL;
  ELSE
    v_status_inicial := 'confirmado_pagamento_na_entrega';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_itens) AS (produto_id UUID, quantidade INT)
  LOOP
    IF v_item.quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para o item selecionado.';
    END IF;

    SELECT * INTO v_produto FROM public.produtos WHERE id = v_item.produto_id FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado.';
    END IF;

    IF NOT v_produto.ativo THEN
      RAISE EXCEPTION 'O produto "%" não está ativo para venda hoje.', v_produto.nome;
    END IF;

    IF v_produto.estoque < v_item.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%". Disponível: %, Solicitado: %.', 
        v_produto.nome, v_produto.estoque, v_item.quantidade;
    END IF;

    v_subtotal := v_produto.preco * v_item.quantidade;
    v_total := v_total + v_subtotal;

    UPDATE public.produtos 
    SET estoque = estoque - v_item.quantidade, atualizado_em = NOW()
    WHERE id = v_item.produto_id;
  END LOOP;

  INSERT INTO public.pedidos (
    nome_cliente, whatsapp, bloco, apartamento, horario_desejado,
    forma_pagamento, status, total, observacoes, expira_em
  ) VALUES (
    TRIM(p_nome_cliente), TRIM(p_whatsapp), TRIM(p_bloco), TRIM(p_apartamento),
    COALESCE(NULLIF(TRIM(p_horario_desejado), ''), 'Assim que possível'),
    p_forma_pagamento, v_status_inicial, v_total, TRIM(p_observacoes), v_expira_em
  )
  RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_itens) AS (produto_id UUID, quantidade INT)
  LOOP
    SELECT * INTO v_produto FROM public.produtos WHERE id = v_item.produto_id;
    INSERT INTO public.itens_pedido (
      pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal
    ) VALUES (
      v_pedido_id, v_item.produto_id, v_produto.nome, v_item.quantidade, v_produto.preco, (v_produto.preco * v_item.quantidade)
    );
  END LOOP;

  INSERT INTO public.historico_status (pedido_id, status_novo, observacao)
  VALUES (v_pedido_id, v_status_inicial, 'Pedido criado pelo cliente no sistema.');

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'total', v_total,
    'status', v_status_inicial,
    'expira_em', v_expira_em
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido_devolver_estoque(
  p_pedido_id UUID,
  p_motivo TEXT DEFAULT 'Cancelado pela administração'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_pedido.status IN ('cancelado', 'expirado') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pedido já estava cancelado ou expirado.');
  END IF;

  FOR v_item IN SELECT * FROM public.itens_pedido WHERE pedido_id = p_pedido_id
  LOOP
    UPDATE public.produtos
    SET estoque = estoque + v_item.quantidade, atualizado_em = NOW()
    WHERE id = v_item.produto_id;
  END LOOP;

  UPDATE public.pedidos
  SET status = 'cancelado', atualizado_em = NOW()
  WHERE id = p_pedido_id;

  INSERT INTO public.historico_status (pedido_id, status_anterior, status_novo, observacao)
  VALUES (p_pedido_id, v_pedido.status, 'cancelado', p_motivo);

  RETURN jsonb_build_object('success', true, 'message', 'Pedido cancelado e estoque retornado com sucesso.');
END;
$$;

CREATE OR REPLACE FUNCTION public.expirar_pedidos_pix_vencidos()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido RECORD;
  v_item RECORD;
  v_count INT := 0;
BEGIN
  FOR v_pedido IN 
    SELECT * FROM public.pedidos 
    WHERE status = 'aguardando_pagamento_pix' 
      AND expira_em IS NOT NULL 
      AND expira_em < NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    FOR v_item IN SELECT * FROM public.itens_pedido WHERE pedido_id = v_pedido.id
    LOOP
      UPDATE public.produtos
      SET estoque = estoque + v_item.quantidade, atualizado_em = NOW()
      WHERE id = v_item.produto_id;
    END LOOP;

    UPDATE public.pedidos SET status = 'expirado', atualizado_em = NOW() WHERE id = v_pedido.id;

    INSERT INTO public.historico_status (pedido_id, status_anterior, status_novo, observacao)
    VALUES (v_pedido.id, 'aguardando_pagamento_pix', 'expirado', 'Tempo limite de reserva de Pix expirado.');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
