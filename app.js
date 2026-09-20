/**
 * AMOR E GELATTO — APLICAÇÃO WEB MOBILE-FIRST
 * Gerenciamento de Vitrine, Pedidos, Estoque, Upload de Fotos, Horários e Relatórios de Vendas
 */

const ALL_TIME_SLOTS = [
  'Assim que possível (Imediato)',
  'Entre 13h e 14h',
  'Entre 14h e 15h',
  'Entre 15h e 16h',
  'Entre 16h e 17h',
  'Entre 17h e 18h',
  'Entre 18h e 19h',
  'Entre 19h e 20h',
  'Entre 20h e 21:30h'
];

const DEFAULT_CONFIG = {
  loja_aberta: true,
  mensagem_entrega: 'Entregas imediatas nos blocos enquanto houver disponibilidade.',
  horarios_disponiveis: [...ALL_TIME_SLOTS],
  chave_pix: 'pix@amorgelatto.com.br',
  tipo_chave_pix: 'Chave E-mail',
  nome_titular_pix: 'Amor e Gelatto Artesanal',
  duracao_reserva_pix_minutos: 15,
  pix_ativo: true,
  dinheiro_ativo: true,
  cartao_entrega_ativo: true,
  telefone_whatsapp: '5511987654321'
};

const DEFAULT_PRODUTOS = [
  {
    id: 'prod-1',
    nome: 'Gelatto de Pistache Siciliano & Frutas Vermelhas (500ml)',
    descricao: 'Pistache siciliano puro com sorbet artesanal de framboesa fresca colhida no dia. Textura cremosa e aveludada.',
    categoria: 'Gelattos Artesanais',
    preco: 34.00,
    estoque: 8,
    foto_url: 'assets/gelatto.jpg',
    ativo: true
  },
  {
    id: 'prod-2',
    nome: 'Fatia de Bolo de Cenoura com Brigadeiro Belga',
    descricao: 'Fatia generosa e fofa com cobertura espessa de brigadeiro cremoso 54% cacau escorrendo pelas laterais.',
    categoria: 'Doces & Bolos',
    preco: 15.00,
    estoque: 12,
    foto_url: 'assets/bolo_cenoura.jpg',
    ativo: true
  },
  {
    id: 'prod-3',
    nome: 'Empadão Artesanal de Frango Cremoso',
    descricao: 'Massa podre artesanal que derrete na boca com recheio farto de peito de frango desfiado, milho e requeijão.',
    categoria: 'Salgados Especiais',
    preco: 18.50,
    estoque: 6,
    foto_url: 'assets/empadao.jpg',
    ativo: true
  },
  {
    id: 'prod-4',
    nome: 'Caldo Verde Especial da Casa (500ml)',
    descricao: 'Caldo quentinho de batata com couve cortada fininha, calabresa defumada artesanal e fio de azeite extravirgem.',
    categoria: 'Caldos do Dia',
    preco: 22.00,
    estoque: 5,
    foto_url: 'assets/caldo_verde.jpg',
    ativo: true
  }
];

class AmorEGelattoApp {
  constructor() {
    this.supabase = null;
    this.isSupabaseActive = false;

    this.config = this.load('ag_config', DEFAULT_CONFIG);
    if (!this.config.horarios_disponiveis) {
      this.config.horarios_disponiveis = [...ALL_TIME_SLOTS];
    }

    this.produtos = this.load('ag_produtos', DEFAULT_PRODUTOS);
    this.pedidos = this.load('ag_pedidos', []);
    this.carrinho = this.load('ag_carrinho', {});
    this.currentOrder = null;
    this.adminLoggedIn = false;
    this.adminActiveTab = 'pedidos'; // 'pedidos' | 'estoque' | 'horarios' | 'relatorios'

    // Filtros do Admin
    this.adminFilterDate = 'hoje'; // 'hoje' | 'ontem' | 'todos' | 'custom'
    this.adminCustomDate = new Date().toISOString().split('T')[0];
    this.adminSearchQuery = '';
    this.adminFilterStatus = 'todos';
    this.reportPeriod = '30d'; // '7d' | '30d' | 'mes' | 'todos'

    this.productModalState = null; // Para cadastro/edição com imagem
    this.pixTimerInterval = null;

    this.initSupabaseClient();
    this.init();
  }

  initSupabaseClient() {
    if (window.supabase && window.AMOR_E_GELATTO_CONFIG && window.AMOR_E_GELATTO_CONFIG.isSupabaseConfigured()) {
      try {
        this.supabase = window.supabase.createClient(
          window.AMOR_E_GELATTO_CONFIG.SUPABASE_URL,
          window.AMOR_E_GELATTO_CONFIG.SUPABASE_ANON_KEY
        );
        this.isSupabaseActive = true;
      } catch (e) {
        console.warn('Erro ao conectar com Supabase:', e);
        this.isSupabaseActive = false;
      }
    }
  }

  load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar no localStorage', e);
    }
  }

  async init() {
    if (this.isSupabaseActive) {
      await this.syncWithSupabase();
    }

    this.checkExpiredPixOrders();
    setInterval(() => this.checkExpiredPixOrders(), 10000);

    this.bindEvents();
    this.render();
  }

  async syncWithSupabase() {
    if (!this.supabase) return;
    try {
      const { data: confData, error: confErr } = await this.supabase
        .from('loja_config')
        .select('*')
        .eq('id', 1)
        .single();
      if (!confErr && confData) {
        this.config = { ...this.config, ...confData };
        this.save('ag_config', this.config);
      }

      const { data: prodData, error: prodErr } = await this.supabase
        .from('produtos')
        .select('*')
        .order('ordem', { ascending: true });
      if (!prodErr && prodData && prodData.length > 0) {
        this.produtos = prodData;
        this.save('ag_produtos', this.produtos);
      }

      if (this.adminLoggedIn) {
        const { data: pedData, error: pedErr } = await this.supabase
          .from('pedidos')
          .select('*, itens_pedido(*)')
          .order('criado_em', { ascending: false });
        if (!pedErr && pedData) {
          this.pedidos = pedData.map(p => ({
            ...p,
            itens: p.itens_pedido || []
          }));
          this.save('ag_pedidos', this.pedidos);
        }
      }
    } catch (e) {
      console.warn('Falha na sincronização Supabase:', e);
    }
  }

  async checkExpiredPixOrders() {
    if (this.isSupabaseActive) {
      try {
        await this.supabase.rpc('expirar_pedidos_pix_vencidos');
      } catch (e) {
        console.warn('Erro ao expirar pedidos via RPC Supabase', e);
      }
    }

    const now = new Date().getTime();
    let updated = false;

    this.pedidos.forEach(pedido => {
      if (pedido.status === 'aguardando_pagamento_pix' && pedido.expira_em) {
        const expireTime = new Date(pedido.expira_em).getTime();
        if (now > expireTime) {
          pedido.status = 'expirado';
          pedido.itens.forEach(item => {
            const prod = this.produtos.find(p => p.id === item.produto_id);
            if (prod) prod.estoque += item.quantidade;
          });
          updated = true;
        }
      }
    });

    if (updated) {
      this.save('ag_pedidos', this.pedidos);
      this.save('ag_produtos', this.produtos);
      this.render();
    }
  }

  // Carrinho
  addToCart(produtoId) {
    if (!this.config.loja_aberta) {
      alert('A loja está fechada no momento.');
      return;
    }

    const prod = this.produtos.find(p => p.id === produtoId);
    if (!prod || prod.estoque <= 0) {
      alert('Produto esgotado!');
      return;
    }

    const currentQty = this.carrinho[produtoId] || 0;
    if (currentQty + 1 > prod.estoque) {
      alert(`Quantidade máxima disponível em estoque: ${prod.estoque} unidades.`);
      return;
    }

    this.carrinho[produtoId] = currentQty + 1;
    this.save('ag_carrinho', this.carrinho);
    this.render();
  }

  updateCartQty(produtoId, delta) {
    const prod = this.produtos.find(p => p.id === produtoId);
    if (!prod) return;

    const currentQty = this.carrinho[produtoId] || 0;
    const newQty = currentQty + delta;

    if (newQty <= 0) {
      delete this.carrinho[produtoId];
    } else {
      if (newQty > prod.estoque) {
        alert(`Estoque máximo disponível: ${prod.estoque}`);
        return;
      }
      this.carrinho[produtoId] = newQty;
    }

    this.save('ag_carrinho', this.carrinho);
    this.render();
  }

  getCartSummary() {
    let count = 0;
    let total = 0;
    const items = [];

    for (const [prodId, qty] of Object.entries(this.carrinho)) {
      const prod = this.produtos.find(p => p.id === prodId);
      if (prod && qty > 0) {
        count += qty;
        const subtotal = prod.preco * qty;
        total += subtotal;
        items.push({
          produto_id: prod.id,
          nome: prod.nome,
          preco: prod.preco,
          quantidade: qty,
          subtotal: subtotal
        });
      }
    }

    return { count, total, items };
  }

  async finalizarPedido(formData) {
    if (!this.config.loja_aberta) {
      alert('A loja está fechada no momento.');
      return null;
    }

    const { count, total, items } = this.getCartSummary();
    if (count === 0) {
      alert('Seu carrinho está vazio!');
      return null;
    }

    if (this.isSupabaseActive && this.supabase) {
      try {
        const payloadItens = items.map(it => ({
          produto_id: it.produto_id,
          quantidade: it.quantidade
        }));

        const { data: resData, error: rpcError } = await this.supabase.rpc('criar_pedido_com_reserva', {
          p_nome_cliente: formData.nome,
          p_whatsapp: formData.whatsapp,
          p_bloco: formData.bloco,
          p_apartamento: formData.apartamento,
          p_horario_desejado: formData.horario_desejado,
          p_forma_pagamento: formData.forma_pagamento,
          p_observacoes: formData.observacoes,
          p_itens: payloadItens
        });

        if (rpcError) {
          alert('Erro ao processar pedido: ' + rpcError.message);
          return null;
        }

        const pedidoCriado = {
          id: resData.pedido_id,
          numero_pedido: resData.numero_pedido,
          nome_cliente: formData.nome,
          whatsapp: formData.whatsapp,
          bloco: formData.bloco,
          apartamento: formData.apartamento,
          horario_desejado: formData.horario_desejado || 'Assim que possível',
          forma_pagamento: formData.forma_pagamento,
          observacoes: formData.observacoes || '',
          status: resData.status,
          total: resData.total,
          itens: items,
          expira_em: resData.expira_em,
          criado_em: new Date().toISOString()
        };

        this.carrinho = {};
        this.save('ag_carrinho', this.carrinho);
        await this.syncWithSupabase();

        this.currentOrder = pedidoCriado;
        return pedidoCriado;
      } catch (e) {
        console.error('Falha na chamada Supabase RPC:', e);
      }
    }

    // Fallback Local
    for (const item of items) {
      const prod = this.produtos.find(p => p.id === item.produto_id);
      if (!prod || prod.estoque < item.quantidade) {
        alert(`Desculpe! O estoque de "${item.nome}" acabou de ser atualizado e não possui a quantidade solicitada.`);
        return null;
      }
    }

    items.forEach(item => {
      const prod = this.produtos.find(p => p.id === item.produto_id);
      if (prod) prod.estoque -= item.quantidade;
    });

    const formaPagamento = formData.forma_pagamento;
    let status = 'confirmado_pagamento_na_entrega';
    let expiraEm = null;

    if (formaPagamento === 'pix') {
      status = 'aguardando_pagamento_pix';
      const durationMs = (this.config.duracao_reserva_pix_minutos || 15) * 60 * 1000;
      expiraEm = new Date(Date.now() + durationMs).toISOString();
    }

    const numeroPedido = (this.pedidos.length > 0 ? Math.max(...this.pedidos.map(p => p.numero_pedido || 0)) : 100) + 1;

    const novoPedido = {
      id: 'ped-' + Date.now(),
      numero_pedido: numeroPedido,
      nome_cliente: formData.nome,
      whatsapp: formData.whatsapp,
      bloco: formData.bloco,
      apartamento: formData.apartamento,
      horario_desejado: formData.horario_desejado || 'Assim que possível',
      forma_pagamento: formaPagamento,
      observacoes: formData.observacoes || '',
      status: status,
      total: total,
      itens: items,
      expira_em: expiraEm,
      criado_em: new Date().toISOString()
    };

    this.pedidos.unshift(novoPedido);
    this.carrinho = {};

    this.save('ag_pedidos', this.pedidos);
    this.save('ag_produtos', this.produtos);
    this.save('ag_carrinho', this.carrinho);

    this.currentOrder = novoPedido;
    return novoPedido;
  }

  getWhatsAppUrl(pedido) {
    const itensTexto = pedido.itens
      .map(it => `• ${it.quantidade}x ${it.nome} (R$ ${it.subtotal.toFixed(2).replace('.', ',')})`)
      .join('%0A');

    const formaPagamentoNome = {
      pix: 'Pix (Reserva de 15 min)',
      dinheiro: 'Dinheiro na Entrega',
      cartao_entrega: 'Cartão na Maquininha (Entrega)'
    }[pedido.forma_pagamento] || pedido.forma_pagamento;

    const mensagem = 
      `Olá! Acabei de fazer o pedido nº *${pedido.numero_pedido}* no Amor e Gelatto.%0A%0A` +
      `*Cliente:* ${pedido.nome_cliente}%0A` +
      `*Entrega:* Bloco ${pedido.bloco}, Apto ${pedido.apartamento}%0A` +
      `*Horário Desejado:* ${pedido.horario_desejado}%0A` +
      (pedido.observacoes ? `*Obs:* ${pedido.observacoes}%0A` : '') +
      `%0A*Itens do Pedido:*%0A${itensTexto}%0A%0A` +
      `*Total:* R$ ${pedido.total.toFixed(2).replace('.', ',')}%0A` +
      `*Pagamento:* ${formaPagamentoNome}%0A%0A` +
      `Muito obrigado(a)!`;

    return `https://wa.me/${this.config.telefone_whatsapp}?text=${mensagem}`;
  }

  // ==========================================================================
  // ADMIN LOGIC & ACTIONS
  // ==========================================================================

  async toggleLojaStatus() {
    this.config.loja_aberta = !this.config.loja_aberta;
    this.save('ag_config', this.config);

    if (this.isSupabaseActive && this.supabase) {
      try {
        await this.supabase.from('loja_config').update({ loja_aberta: this.config.loja_aberta }).eq('id', 1);
      } catch (e) {
        console.warn('Erro ao atualizar status no Supabase:', e);
      }
    }

    this.render();
  }

  async toggleProductActive(productId) {
    const prod = this.produtos.find(p => p.id === productId);
    if (!prod) return;

    prod.ativo = !prod.ativo;
    this.save('ag_produtos', this.produtos);

    if (this.isSupabaseActive && this.supabase && !productId.startsWith('prod-')) {
      try {
        await this.supabase.from('produtos').update({ ativo: prod.ativo }).eq('id', productId);
      } catch (e) {
        console.warn('Erro ao alternar status do produto no Supabase:', e);
      }
    }

    this.render();
  }

  async toggleTimeSlot(slotName) {
    if (!this.config.horarios_disponiveis) {
      this.config.horarios_disponiveis = [...ALL_TIME_SLOTS];
    }

    const idx = this.config.horarios_disponiveis.indexOf(slotName);
    if (idx !== -1) {
      if (this.config.horarios_disponiveis.length === 1) {
        alert('Mantenha pelo menos um horário de entrega ativo.');
        return;
      }
      this.config.horarios_disponiveis.splice(idx, 1);
    } else {
      this.config.horarios_disponiveis.push(slotName);
    }

    this.save('ag_config', this.config);

    if (this.isSupabaseActive && this.supabase) {
      try {
        await this.supabase.from('loja_config').update({
          horarios_disponiveis: this.config.horarios_disponiveis
        }).eq('id', 1);
      } catch (e) {
        console.warn('Erro ao atualizar horários no Supabase:', e);
      }
    }

    this.render();
  }

  async updatePedidoStatus(pedidoId, novoStatus) {
    const pedido = this.pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    if (this.isSupabaseActive && this.supabase) {
      if (novoStatus === 'cancelado') {
        try {
          await this.supabase.rpc('cancelar_pedido_devolver_estoque', { p_pedido_id: pedidoId });
          await this.syncWithSupabase();
          this.render();
          return;
        } catch (e) {
          console.warn('Erro na RPC de cancelamento:', e);
        }
      } else {
        try {
          await this.supabase.from('pedidos').update({ status: novoStatus }).eq('id', pedidoId);
        } catch (e) {
          console.warn('Erro ao atualizar status do pedido:', e);
        }
      }
    }

    if (novoStatus === 'cancelado' && pedido.status !== 'cancelado' && pedido.status !== 'expirado') {
      pedido.itens.forEach(it => {
        const prod = this.produtos.find(p => p.id === it.produto_id);
        if (prod) prod.estoque += it.quantidade;
      });
      this.save('ag_produtos', this.produtos);
    }

    pedido.status = novoStatus;
    this.save('ag_pedidos', this.pedidos);
    this.render();
  }

  async saveProduct(productData) {
    if (this.isSupabaseActive && this.supabase) {
      try {
        if (productData.id && !productData.id.startsWith('prod-')) {
          await this.supabase.from('produtos').update(productData).eq('id', productData.id);
        } else {
          await this.supabase.from('produtos').insert(productData);
        }
        await this.syncWithSupabase();
        this.render();
        return;
      } catch (e) {
        console.warn('Erro ao salvar produto no Supabase:', e);
      }
    }

    if (productData.id) {
      const idx = this.produtos.findIndex(p => p.id === productData.id);
      if (idx !== -1) {
        this.produtos[idx] = { ...this.produtos[idx], ...productData };
      }
    } else {
      const newProd = {
        id: 'prod-' + Date.now(),
        ...productData,
        ativo: true
      };
      this.produtos.push(newProd);
    }

    this.save('ag_produtos', this.produtos);
    this.productModalState = null;
    this.render();
  }

  async deleteProduct(produtoId) {
    if (confirm('Deseja realmente excluir este produto?')) {
      if (this.isSupabaseActive && this.supabase && !produtoId.startsWith('prod-')) {
        try {
          await this.supabase.from('produtos').delete().eq('id', produtoId);
          await this.syncWithSupabase();
          this.render();
          return;
        } catch (e) {
          console.warn('Erro ao excluir no Supabase:', e);
        }
      }

      this.produtos = this.produtos.filter(p => p.id !== produtoId);
      this.save('ag_produtos', this.produtos);
      this.render();
    }
  }

  // Filtragem inteligente de pedidos
  getFilteredPedidos() {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return this.pedidos.filter(p => {
      const pedidoDateStr = (p.criado_em || '').split('T')[0];

      // 1. Filtro por Data
      if (this.adminFilterDate === 'hoje') {
        if (pedidoDateStr !== todayStr) return false;
      } else if (this.adminFilterDate === 'ontem') {
        if (pedidoDateStr !== yesterdayStr) return false;
      } else if (this.adminFilterDate === 'custom') {
        if (pedidoDateStr !== this.adminCustomDate) return false;
      }

      // 2. Filtro por Status
      if (this.adminFilterStatus !== 'todos' && p.status !== this.adminFilterStatus) {
        return false;
      }

      // 3. Filtro por Busca (Nome / Bloco / Apartamento)
      if (this.adminSearchQuery.trim()) {
        const query = this.adminSearchQuery.toLowerCase().trim();
        const matchNome = (p.nome_cliente || '').toLowerCase().includes(query);
        const matchBloco = (p.bloco || '').toLowerCase().includes(query);
        const matchApto = (p.apartamento || '').toLowerCase().includes(query);
        const matchNumero = String(p.numero_pedido || '').includes(query);

        if (!matchNome && !matchBloco && !matchApto && !matchNumero) {
          return false;
        }
      }

      return true;
    });
  }

  // Estatísticas e Analytics para o Módulo de Relatórios
  getReportAnalytics() {
    const now = new Date();
    let cutoffDate = new Date(0); // 'todos'

    if (this.reportPeriod === '7d') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (this.reportPeriod === '30d') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (this.reportPeriod === 'mes') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const pedidosValidos = this.pedidos.filter(p => {
      const d = new Date(p.criado_em || Date.now());
      const statusValido = p.status !== 'cancelado' && p.status !== 'expirado';
      return statusValido && d >= cutoffDate;
    });

    const totalFaturado = pedidosValidos.reduce((acc, p) => acc + p.total, 0);
    const totalPedidos = pedidosValidos.length;
    const ticketMedio = totalPedidos > 0 ? totalFaturado / totalPedidos : 0;

    // 1. Ranking de Produtos Mais Vendidos
    const productStats = {};
    pedidosValidos.forEach(p => {
      (p.itens || []).forEach(it => {
        const key = it.nome || it.nome_produto || 'Outro';
        if (!productStats[key]) {
          productStats[key] = { nome: key, quantidade: 0, faturamento: 0 };
        }
        productStats[key].quantidade += it.quantidade;
        productStats[key].faturamento += it.subtotal || (it.preco * it.quantidade) || 0;
      });
    });

    const topProdutos = Object.values(productStats).sort((a, b) => b.quantidade - a.quantidade);
    const maxProdQty = topProdutos.length > 0 ? Math.max(...topProdutos.map(p => p.quantidade)) : 1;

    // 2. Ranking de Melhores Clientes
    const clientStats = {};
    pedidosValidos.forEach(p => {
      const key = `${p.nome_cliente} (Bloco ${p.bloco} - Apto ${p.apartamento})`;
      if (!clientStats[key]) {
        clientStats[key] = {
          nome: p.nome_cliente,
          bloco: p.bloco,
          apartamento: p.apartamento,
          pedidosCount: 0,
          totalGasto: 0
        };
      }
      clientStats[key].pedidosCount += 1;
      clientStats[key].totalGasto += p.total;
    });

    const topClientes = Object.values(clientStats).sort((a, b) => b.totalGasto - a.totalGasto);

    // 3. Vendas por Dia da Semana
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const vendasPorDia = diasSemana.map(dia => ({ dia, pedidos: 0, total: 0 }));

    pedidosValidos.forEach(p => {
      const d = new Date(p.criado_em || Date.now());
      const dayIdx = d.getDay();
      vendasPorDia[dayIdx].pedidos += 1;
      vendasPorDia[dayIdx].total += p.total;
    });

    return {
      totalFaturado,
      totalPedidos,
      ticketMedio,
      topProdutos,
      maxProdQty,
      topClientes,
      vendasPorDia
    };
  }

  // ==========================================================================
  // RENDER VIEWS
  // ==========================================================================

  render() {
    const root = document.getElementById('app');
    if (!root) return;

    const hash = window.location.hash;

    if (hash.startsWith('#admin')) {
      if (!this.adminLoggedIn) {
        root.innerHTML = this.renderAdminLogin();
      } else {
        root.innerHTML = this.renderAdminDashboard();
      }
    } else if (hash.startsWith('#pedido') && this.currentOrder) {
      root.innerHTML = this.renderConfirmation(this.currentOrder);
      this.startPixCountdown(this.currentOrder);
    } else if (hash === '#checkout') {
      root.innerHTML = this.renderCheckout();
    } else {
      root.innerHTML = this.renderStore();
    }

    this.bindDynamicEvents();
  }

  renderStore() {
    const { count, total } = this.getCartSummary();
    const lojaAberta = this.config.loja_aberta;
    const produtosAtivos = this.produtos.filter(p => p.ativo);

    return `
      <div class="app-container">
        <header class="app-header">
          <a href="#" class="brand">
            <div class="brand-icon">♥</div>
            <div class="brand-title">Amor e <span>Gelatto</span></div>
          </a>
          <div class="header-actions">
            <button id="btnOpenCart" class="btn-header-cart" aria-label="Abrir Carrinho">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              ${count > 0 ? `<span class="cart-badge">${count}</span>` : ''}
            </button>
            <a href="#admin" class="btn-header-cart" title="Acesso Administradora" style="font-size: 0.8rem; font-weight: 700;">
              ⚙
            </a>
          </div>
        </header>

        <div class="status-banner ${lojaAberta ? 'open' : 'closed'}">
          <div class="status-indicator">
            <span class="status-dot"></span>
            <span>${lojaAberta ? 'Loja Aberta • Pronta Entrega no Condomínio' : 'Loja Fechada no Momento'}</span>
          </div>
          <span style="font-size: 0.78rem; opacity: 0.9;">${lojaAberta ? 'Aceitando Pedidos' : 'Avisaremos no WhatsApp'}</span>
        </div>

        ${lojaAberta ? `
          <div class="delivery-rule-card">
            <div class="delivery-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            </div>
            <div class="delivery-text">
              <h4>Entrega Exclusiva no Condomínio</h4>
              <p>${this.config.mensagem_entrega}</p>
            </div>
          </div>
        ` : `
          <div style="margin: 1.5rem 1.25rem; padding: 2rem 1.25rem; background: #fff; border-radius: var(--radius-lg); text-align: center; border: 1px solid var(--border-subtle);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🍨</div>
            <h3 style="font-family: var(--font-heading); font-size: 1.3rem; margin-bottom: 0.5rem;">Produção do Dia em Andamento</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
              Nossos alimentos são preparados frescos em quantidades limitadas. Assim que a próxima fornada estiver pronta, avisamos no grupo do condomínio!
            </p>
            <a href="https://wa.me/${this.config.telefone_whatsapp}" target="_blank" class="btn-whatsapp btn-block" style="text-decoration: none;">
              Falar no WhatsApp
            </a>
          </div>
        `}

        <div class="section-title">
          <span>Cardápio de Hoje</span>
          <small style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted);">${produtosAtivos.length} opções disponíveis</small>
        </div>

        <main class="product-feed">
          ${produtosAtivos.length === 0 ? `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
              Nenhum produto ativado na vitrine para hoje.
            </div>
          ` : produtosAtivos.map(p => {
            const inCart = this.carrinho[p.id] || 0;
            const esgotado = p.estoque <= 0;

            return `
              <article class="product-card" id="card-${p.id}">
                <div class="product-image-wrap">
                  <img src="${p.foto_url}" alt="${p.nome}" class="product-image" loading="lazy">
                  <span class="product-tag">${p.categoria}</span>
                  <span class="product-stock-tag ${esgotado ? 'out-of-stock' : ''}">
                    ${esgotado ? 'Esgotado' : `${p.estoque} un. disponíveis`}
                  </span>
                </div>
                <div class="product-body">
                  <h3 class="product-name">${p.nome}</h3>
                  <p class="product-desc">${p.descricao}</p>
                  <div class="product-footer">
                    <div class="product-price">
                      <small>R$</small> ${p.preco.toFixed(2).replace('.', ',')}
                    </div>
                    <div>
                      ${!lojaAberta || esgotado ? `
                        <button class="btn-add" disabled>${esgotado ? 'Esgotado' : 'Loja Fechada'}</button>
                      ` : inCart > 0 ? `
                        <div class="qty-control">
                          <button class="qty-btn" onclick="app.updateCartQty('${p.id}', -1)">-</button>
                          <span class="qty-val">${inCart}</span>
                          <button class="qty-btn" onclick="app.updateCartQty('${p.id}', 1)">+</button>
                        </div>
                      ` : `
                        <button class="btn-add" onclick="app.addToCart('${p.id}')">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Adicionar
                        </button>
                      `}
                    </div>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </main>

        ${count > 0 && lojaAberta ? `
          <div class="bottom-cart-bar">
            <div class="bottom-cart-info">
              <span class="bottom-cart-count">${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}</span>
              <span class="bottom-cart-total">R$ ${total.toFixed(2).replace('.', ',')}</span>
            </div>
            <button id="btnGoToCheckout" class="btn-view-cart">
              <span>Ver Pedido</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        ` : ''}

        <div id="cartModal" class="modal-backdrop">
          <div class="drawer-content">
            <div class="drawer-header">
              <h3 class="drawer-title">Seu Carrinho</h3>
              <button id="btnCloseCart" class="btn-close">&times;</button>
            </div>
            <div class="cart-list">
              ${this.getCartSummary().items.map(it => `
                <div class="cart-item">
                  <div class="cart-item-info">
                    <h5>${it.nome}</h5>
                    <p>R$ ${it.preco.toFixed(2).replace('.', ',')} cada</p>
                  </div>
                  <div class="qty-control">
                    <button class="qty-btn" onclick="app.updateCartQty('${it.produto_id}', -1)">-</button>
                    <span class="qty-val">${it.quantidade}</span>
                    <button class="qty-btn" onclick="app.updateCartQty('${it.produto_id}', 1)">+</button>
                  </div>
                </div>
              `).join('')}
            </div>
            <div style="border-top: 1px solid var(--border-subtle); padding-top: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 1.05rem;">Total do Pedido:</span>
              <span style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 800; color: var(--primary);">
                R$ ${total.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <button id="btnProceedCheckout" class="btn-block btn-primary">
              Avançar para Entrega
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderCheckout() {
    const { count, total, items } = this.getCartSummary();
    if (count === 0) {
      window.location.hash = '';
      return '';
    }

    const horariosAtivos = this.config.horarios_disponiveis || ALL_TIME_SLOTS;

    return `
      <div class="app-container">
        <header class="app-header">
          <a href="#" class="brand">
            <div class="brand-icon">←</div>
            <div class="brand-title">Finalizar <span>Pedido</span></div>
          </a>
        </header>

        <div style="padding: 1.25rem;">
          <div style="background: #fff; padding: 1.1rem; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); margin-bottom: 1.25rem;">
            <h4 style="font-family: var(--font-heading); font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">Resumo dos Itens</h4>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.88rem;">
              ${items.map(it => `
                <div style="display: flex; justify-content: space-between;">
                  <span>${it.quantidade}x ${it.nome}</span>
                  <strong>R$ ${it.subtotal.toFixed(2).replace('.', ',')}</strong>
                </div>
              `).join('')}
              <div style="border-top: 1px dashed var(--border-subtle); padding-top: 0.6rem; margin-top: 0.3rem; display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; color: var(--primary);">
                <span>Total:</span>
                <span>R$ ${total.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </div>

          <form id="checkoutForm" style="background: #fff; padding: 1.25rem; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
            <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-dark);">
              Dados para Entrega no Condomínio
            </h4>

            <div class="form-group">
              <label class="form-label" for="clientName">Seu Nome Completo *</label>
              <input type="text" id="clientName" class="form-input" required placeholder="Ex: Maria Silva">
            </div>

            <div class="form-group">
              <label class="form-label" for="clientPhone">WhatsApp para Contato *</label>
              <input type="tel" id="clientPhone" class="form-input" required placeholder="(11) 90000-0000">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="clientBloco">Bloco / Torre *</label>
                <input type="text" id="clientBloco" class="form-input" required placeholder="Ex: Bloco B">
              </div>
              <div class="form-group">
                <label class="form-label" for="clientApto">Apartamento *</label>
                <input type="text" id="clientApto" class="form-input" required placeholder="Ex: Apto 42">
              </div>
            </div>

            <!-- Horários de Entrega Configurados pela Administradora -->
            <div class="form-group">
              <label class="form-label" for="deliveryTime">Horário Desejado para Receber *</label>
              <select id="deliveryTime" class="form-select" required>
                ${horariosAtivos.map(h => `<option value="${h}">${h}</option>`).join('')}
              </select>
              <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 0.3rem;">
                * O horário é uma preferência e será atendido conforme a disponibilidade e rota.
              </small>
            </div>

            <div class="form-group">
              <label class="form-label" for="clientObs">Observação (Opcional)</label>
              <input type="text" id="clientObs" class="form-input" placeholder="Ex: Deixar na portaria, tocar interfone...">
            </div>

            <div style="margin-top: 1.5rem;">
              <label class="form-label">Forma de Pagamento *</label>
              <div class="payment-options">
                ${this.config.pix_ativo ? `
                  <div class="payment-card selected" data-value="pix">
                    <div class="payment-card-icon">⚡</div>
                    <div>
                      <strong style="font-size: 0.95rem; display: block;">Pix (Chave com Cópia Fácil)</strong>
                      <small style="color: var(--text-muted); font-size: 0.8rem;">Reserva garantida por ${this.config.duracao_reserva_pix_minutos} minutos</small>
                    </div>
                  </div>
                ` : ''}

                ${this.config.dinheiro_ativo ? `
                  <div class="payment-card" data-value="dinheiro">
                    <div class="payment-card-icon">💵</div>
                    <div>
                      <strong style="font-size: 0.95rem; display: block;">Dinheiro na Entrega</strong>
                      <small style="color: var(--text-muted); font-size: 0.8rem;">Pagamento no momento do recebimento</small>
                    </div>
                  </div>
                ` : ''}

                ${this.config.cartao_entrega_ativo ? `
                  <div class="payment-card" data-value="cartao_entrega">
                    <div class="payment-card-icon">💳</div>
                    <div>
                      <strong style="font-size: 0.95rem; display: block;">Cartão na Maquininha</strong>
                      <small style="color: var(--text-muted); font-size: 0.8rem;">Débito ou Crédito levado na entrega</small>
                    </div>
                  </div>
                ` : ''}
              </div>
              <input type="hidden" id="selectedPayment" value="pix">
            </div>

            <button type="submit" class="btn-block btn-primary" style="margin-top: 1rem;">
              Confirmar Pedido (R$ ${total.toFixed(2).replace('.', ',')})
            </button>
          </form>
        </div>
      </div>
    `;
  }

  renderConfirmation(pedido) {
    const isPix = pedido.forma_pagamento === 'pix';
    const whatsAppUrl = this.getWhatsAppUrl(pedido);

    return `
      <div class="app-container">
        <header class="app-header">
          <a href="#" class="brand">
            <div class="brand-icon">♥</div>
            <div class="brand-title">Amor e <span>Gelatto</span></div>
          </a>
        </header>

        <div class="confirm-box">
          <div class="confirm-icon">✓</div>
          <h2 style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 800; margin-bottom: 0.3rem;">
            Pedido Realizado com Sucesso!
          </h2>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            Pedido nº <strong>#${pedido.numero_pedido}</strong> para <strong>Bloco ${pedido.bloco}, Apto ${pedido.apartamento}</strong>
          </p>

          ${isPix ? `
            <div class="pix-timer-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Reserva garantida por: <strong id="pixCountdown">15:00</strong></span>
            </div>

            <div class="pix-key-box">
              <span style="font-size: 0.82rem; font-weight: 700; color: var(--secondary-hover);">CHAVE PIX (${this.config.tipo_chave_pix})</span>
              <code id="pixKey">${this.config.chave_pix}</code>
              <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                Titular: <strong>${this.config.nome_titular_pix}</strong> • Valor: <strong>R$ ${pedido.total.toFixed(2).replace('.', ',')}</strong>
              </div>
              <button type="button" id="btnCopyPix" class="btn-block" style="background: var(--secondary); color: #fff; font-size: 0.88rem; padding: 0.6rem;">
                Copiar Chave Pix
              </button>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem;">
              Após transferir, envie o comprovante pelo botão de WhatsApp abaixo para agilizarmos a separação.
            </p>
          ` : `
            <div style="background: var(--bg-creme-alt); padding: 1rem; border-radius: var(--radius-md); margin: 1.2rem 0; font-size: 0.9rem;">
              Seu pedido já foi reservado e o pagamento será realizado na entrega (<strong>${pedido.forma_pagamento === 'dinheiro' ? 'Dinheiro' : 'Cartão na Maquininha'}</strong>).
            </div>
          `}

          <a href="${whatsAppUrl}" target="_blank" rel="noopener noreferrer" class="btn-block btn-whatsapp" style="text-decoration: none; margin-bottom: 0.75rem;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            Enviar Resumo pelo WhatsApp
          </a>

          <a href="#" class="btn-block" style="background: transparent; color: var(--text-muted); font-size: 0.9rem; text-decoration: none;">
            Voltar à Página Inicial
          </a>
        </div>
      </div>
    `;
  }

  startPixCountdown(pedido) {
    if (this.pixTimerInterval) clearInterval(this.pixTimerInterval);
    if (!pedido.expira_em) return;

    const targetTime = new Date(pedido.expira_em).getTime();
    const update = () => {
      const now = new Date().getTime();
      const diff = targetTime - now;

      const timerElem = document.getElementById('pixCountdown');
      if (!timerElem) {
        clearInterval(this.pixTimerInterval);
        return;
      }

      if (diff <= 0) {
        timerElem.innerText = 'Expirado';
        timerElem.parentElement.style.background = '#fee2e2';
        timerElem.parentElement.style.color = '#dc2626';
        clearInterval(this.pixTimerInterval);
        this.checkExpiredPixOrders();
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        timerElem.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    };

    update();
    this.pixTimerInterval = setInterval(update, 1000);
  }

  // ==========================================================================
  // ADMIN DASHBOARD
  // ==========================================================================

  renderAdminLogin() {
    return `
      <div class="app-container">
        <header class="app-header">
          <a href="#" class="brand">
            <div class="brand-icon">←</div>
            <div class="brand-title">Painel <span>Administrativo</span></div>
          </a>
        </header>

        <div style="padding: 2rem 1.25rem;">
          <div style="background: #fff; padding: 2rem 1.5rem; border-radius: var(--radius-xl); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-md);">
            <div style="text-align: center; margin-bottom: 1.5rem;">
              <div style="font-size: 2rem; margin-bottom: 0.3rem;">🔐</div>
              <h3 style="font-family: var(--font-heading); font-size: 1.3rem;">Acesso da Administradora</h3>
              <p style="font-size: 0.85rem; color: var(--text-muted);">Gerencie abertura, produtos, estoque, pedidos e relatórios</p>
            </div>

            <form id="adminLoginForm">
              <div class="form-group">
                <label class="form-label" for="adminEmail">E-mail</label>
                <input type="email" id="adminEmail" class="form-input" required value="admin@amorgelatto.com.br">
              </div>
              <div class="form-group">
                <label class="form-label" for="adminPassword">Senha</label>
                <input type="password" id="adminPassword" class="form-input" required value="admin123">
              </div>
              <button type="submit" class="btn-block btn-primary">Entrar no Painel</button>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  renderAdminDashboard() {
    const filteredPedidos = this.getFilteredPedidos();
    const analytics = this.getReportAnalytics();
    const horariosAtivos = this.config.horarios_disponiveis || ALL_TIME_SLOTS;

    return `
      <div class="app-container admin-view">
        <header class="app-header">
          <div class="brand">
            <div class="brand-icon">⚙</div>
            <div class="brand-title">Amor e Gelatto • <span>Painel</span></div>
          </div>
          <div class="header-actions">
            <a href="#" class="btn-header-cart" title="Ver Loja Pública">👁</a>
            <button id="btnAdminLogout" class="btn-header-cart" title="Sair">🚪</button>
          </div>
        </header>

        <div style="padding: 1.25rem;">
          <!-- Status de Conexão Supabase -->
          <div style="margin-bottom: 1rem; padding: 0.55rem 0.9rem; background: ${this.isSupabaseActive ? '#ecfdf5' : '#fffbeb'}; border: 1px solid ${this.isSupabaseActive ? '#a7f3d0' : '#fde68a'}; border-radius: var(--radius-md); font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <strong>Banco:</strong> ${this.isSupabaseActive ? '🟢 Supabase Conectado' : '🟡 Modo Local (Offline)'}
            </div>
            <button onclick="app.promptSupabaseConfig()" style="background: none; border: none; color: var(--secondary-hover); font-weight: 700; cursor: pointer; text-decoration: underline;">
              Configurar Supabase
            </button>
          </div>

          <!-- Tabs de Navegação no Painel -->
          <nav class="admin-nav-tabs">
            <button class="admin-tab-btn ${this.adminActiveTab === 'pedidos' ? 'active' : ''}" onclick="app.setAdminTab('pedidos')">
              📦 Pedidos (${this.pedidos.length})
            </button>
            <button class="admin-tab-btn ${this.adminActiveTab === 'estoque' ? 'active' : ''}" onclick="app.setAdminTab('estoque')">
              🍨 Produtos & Vitrine (${this.produtos.length})
            </button>
            <button class="admin-tab-btn ${this.adminActiveTab === 'horarios' ? 'active' : ''}" onclick="app.setAdminTab('horarios')">
              ⏰ Horários de Entrega
            </button>
            <button class="admin-tab-btn ${this.adminActiveTab === 'relatorios' ? 'active' : ''}" onclick="app.setAdminTab('relatorios')">
              📊 Relatório de Vendas
            </button>
          </nav>

          <!-- CONTEÚDO DA TAB SELECIONADA -->
          ${this.adminActiveTab === 'pedidos' ? this.renderTabPedidos(filteredPedidos) : ''}
          ${this.adminActiveTab === 'estoque' ? this.renderTabEstoque() : ''}
          ${this.adminActiveTab === 'horarios' ? this.renderTabHorarios(horariosAtivos) : ''}
          ${this.adminActiveTab === 'relatorios' ? this.renderTabRelatorios(analytics) : ''}
        </div>

        <!-- Modal de Cadastro / Edição de Produto com Upload de Imagem Real -->
        ${this.productModalState ? this.renderProductModal() : ''}
      </div>
    `;
  }

  // TAB 1: PEDIDOS COM FILTROS AVANÇADOS (DATA, CLIENTE, BLOCO/APTO)
  renderTabPedidos(filteredPedidos) {
    return `
      <!-- Controle de Abertura e Mensagem de Entrega -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700;">Status da Loja</h4>
          <button id="btnToggleLoja" class="btn-block" style="width: auto; padding: 0.4rem 1rem; font-size: 0.85rem; background: ${this.config.loja_aberta ? '#ef4444' : '#10b981'}; color: #fff;">
            ${this.config.loja_aberta ? 'Fechar Loja Agora' : 'Abrir Loja Agora'}
          </button>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 0.8rem;">Aviso de Entrega do Dia:</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="adminDeliveryMsg" class="form-input" value="${this.config.mensagem_entrega}">
            <button id="btnSaveDeliveryMsg" class="btn-add" style="border-radius: var(--radius-md);">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Barra de Filtros de Pedidos -->
      <div class="admin-filters-bar">
        <div>
          <label class="form-label" style="font-size: 0.78rem;">Filtrar por Período / Data:</label>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button class="admin-tab-btn ${this.adminFilterDate === 'hoje' ? 'active' : ''}" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;" onclick="app.setFilterDate('hoje')">Hoje</button>
            <button class="admin-tab-btn ${this.adminFilterDate === 'ontem' ? 'active' : ''}" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;" onclick="app.setFilterDate('ontem')">Ontem</button>
            <button class="admin-tab-btn ${this.adminFilterDate === 'todos' ? 'active' : ''}" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;" onclick="app.setFilterDate('todos')">Todos</button>
            <input type="date" value="${this.adminCustomDate}" class="form-input" style="width: auto; padding: 0.2rem 0.5rem; font-size: 0.78rem;" onchange="app.setCustomDate(this.value)">
          </div>
        </div>

        <div>
          <label class="form-label" for="searchOrders" style="font-size: 0.78rem;">Buscar Cliente ou Bloco/Apto:</label>
          <input type="text" id="searchOrders" placeholder="Nome, Bloco, Apto..." value="${this.adminSearchQuery}" class="form-input" style="padding: 0.45rem 0.75rem; font-size: 0.85rem;" oninput="app.setSearchQuery(this.value)">
        </div>

        <div>
          <label class="form-label" for="filterStatus" style="font-size: 0.78rem;">Filtrar por Status:</label>
          <select id="filterStatus" class="form-select" style="padding: 0.45rem 0.75rem; font-size: 0.85rem;" onchange="app.setFilterStatus(this.value)">
            <option value="todos" ${this.adminFilterStatus === 'todos' ? 'selected' : ''}>Todos os Status</option>
            <option value="aguardando_pagamento_pix" ${this.adminFilterStatus === 'aguardando_pagamento_pix' ? 'selected' : ''}>Aguardando Pix</option>
            <option value="pago" ${this.adminFilterStatus === 'pago' ? 'selected' : ''}>Pix Pago</option>
            <option value="confirmado_pagamento_na_entrega" ${this.adminFilterStatus === 'confirmado_pagamento_na_entrega' ? 'selected' : ''}>Confirmado (Entrega)</option>
            <option value="em_separacao" ${this.adminFilterStatus === 'em_separacao' ? 'selected' : ''}>Em Separação</option>
            <option value="saiu_para_entrega" ${this.adminFilterStatus === 'saiu_para_entrega' ? 'selected' : ''}>Saiu p/ Entrega</option>
            <option value="entregue" ${this.adminFilterStatus === 'entregue' ? 'selected' : ''}>Entregue</option>
            <option value="cancelado" ${this.adminFilterStatus === 'cancelado' ? 'selected' : ''}>Cancelados</option>
          </select>
        </div>
      </div>

      <!-- Tabela de Pedidos Filtrados -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h4 style="font-family: var(--font-heading); font-size: 1rem; font-weight: 700;">
            Pedidos Encontrados (${filteredPedidos.length})
          </h4>
          <small style="color: var(--text-muted); font-size: 0.8rem;">Atualização automática</small>
        </div>

        ${filteredPedidos.length === 0 ? `
          <p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 2rem 0;">Nenhum pedido encontrado com os filtros aplicados.</p>
        ` : `
          <div style="overflow-x: auto;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Data/Hora</th>
                  <th>Cliente & Entrega</th>
                  <th>Itens do Pedido</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${filteredPedidos.map(p => {
                  const d = new Date(p.criado_em || Date.now());
                  const dataFormatada = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

                  return `
                    <tr>
                      <td><strong>#${p.numero_pedido}</strong></td>
                      <td><small style="color: var(--text-muted); white-space: nowrap;">${dataFormatada}</small></td>
                      <td>
                        <strong>${p.nome_cliente}</strong><br>
                        <small style="color: var(--text-dark); font-weight: 600;">Bloco ${p.bloco}, Apto ${p.apartamento}</small><br>
                        <small style="color: var(--secondary); font-weight: 600;">⏰ ${p.horario_desejado}</small><br>
                        <small style="color: var(--text-muted);">WhatsApp: ${p.whatsapp}</small>
                        ${p.observacoes ? `<br><small style="color: #d97706; font-style: italic;">Obs: ${p.observacoes}</small>` : ''}
                      </td>
                      <td>
                        <small>${p.itens.map(it => `• ${it.quantidade}x ${it.nome || it.nome_produto}`).join('<br>')}</small>
                      </td>
                      <td><strong style="color: var(--primary);">R$ ${p.total.toFixed(2).replace('.', ',')}</strong></td>
                      <td>
                        <span class="badge-status ${p.status}">
                          ${p.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <select onchange="app.updatePedidoStatus('${p.id}', this.value)" class="form-select" style="padding: 0.35rem 0.5rem; font-size: 0.78rem;">
                          <option value="aguardando_pagamento_pix" ${p.status === 'aguardando_pagamento_pix' ? 'selected' : ''}>Aguardando Pix</option>
                          <option value="pago" ${p.status === 'pago' ? 'selected' : ''}>Pix Pago</option>
                          <option value="confirmado_pagamento_na_entrega" ${p.status === 'confirmado_pagamento_na_entrega' ? 'selected' : ''}>Confirmado (Entrega)</option>
                          <option value="em_separacao" ${p.status === 'em_separacao' ? 'selected' : ''}>Em Separação</option>
                          <option value="saiu_para_entrega" ${p.status === 'saiu_para_entrega' ? 'selected' : ''}>Saiu p/ Entrega</option>
                          <option value="entregue" ${p.status === 'entregue' ? 'selected' : ''}>Entregue</option>
                          <option value="cancelado" ${p.status === 'cancelado' ? 'selected' : ''}>Cancelar (Devolve Estoque)</option>
                        </select>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  // TAB 2: ESTOQUE E GESTÃO DE PRODUTOS (COM TOGGLE ATIVAR/DESATIVAR E UPLOAD DE FOTOS)
  renderTabEstoque() {
    return `
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <div>
            <h4 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 700;">Cardápio & Vitrine de Produtos</h4>
            <p style="font-size: 0.82rem; color: var(--text-muted);">
              Ative ou desative produtos na vitrine conforme sua produção do dia sem precisar recadastrá-los.
            </p>
          </div>
          <button onclick="app.openProductModal()" class="btn-add">+ Cadastrar Produto</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${this.produtos.map(p => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.9rem; background: var(--bg-creme-alt); border-radius: var(--radius-md); border: 1px solid ${p.ativo ? 'var(--border-subtle)' : '#e2e8f0'}; opacity: ${p.ativo ? '1' : '0.65'};">
              <div style="display: flex; align-items: center; gap: 0.85rem;">
                <img src="${p.foto_url}" alt="${p.nome}" style="width: 58px; height: 58px; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border-subtle);">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <strong style="font-size: 0.98rem;">${p.nome}</strong>
                    <span style="font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); background: ${p.ativo ? '#dcfce7; color: #166534;' : '#f1f5f9; color: #64748b;'}">
                      ${p.ativo ? 'Na Vitrine' : 'Oculto'}
                    </span>
                  </div>
                  <small style="color: var(--text-muted); font-size: 0.82rem;">R$ ${p.preco.toFixed(2).replace('.', ',')} • ${p.categoria}</small>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 1rem;">
                <!-- Toggle Ativar/Desativar na Vitrine -->
                <div style="text-align: center;">
                  <span style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Exibir na Loja:</span>
                  <label class="switch-toggle" title="Ativar ou desativar na vitrine">
                    <input type="checkbox" ${p.ativo ? 'checked' : ''} onchange="app.toggleProductActive('${p.id}')">
                    <span class="slider-round"></span>
                  </label>
                </div>

                <!-- Quantidade em Estoque -->
                <div style="text-align: right;">
                  <span style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Estoque Hoje:</span>
                  <input type="number" min="0" value="${p.estoque}" style="width: 65px; padding: 0.3rem 0.5rem; font-weight: 700; font-size: 0.9rem; border-radius: var(--radius-sm); border: 1.5px solid var(--border-subtle); text-align: center;" onchange="app.saveProduct({ id: '${p.id}', estoque: parseInt(this.value) || 0 })">
                </div>

                <!-- Editar / Excluir -->
                <button onclick="app.openProductModal('${p.id}')" style="background: none; border: none; color: var(--secondary-hover); font-size: 1.1rem; cursor: pointer;" title="Editar">✏️</button>
                <button onclick="app.deleteProduct('${p.id}')" style="background: none; border: none; color: #ef4444; font-size: 1.1rem; cursor: pointer;" title="Excluir">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // TAB 3: GERENCIAMENTO DE HORÁRIOS DE ENTREGA DISPONÍVEIS
  renderTabHorarios(horariosAtivos) {
    return `
      <div class="admin-card">
        <h4 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 700; margin-bottom: 0.35rem;">
          Horários de Entrega Disponíveis no Checkout
        </h4>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Marque os horários que você atenderá hoje. O cliente só verá para escolha as opções marcadas abaixo.
        </p>

        <div class="time-slots-grid">
          ${ALL_TIME_SLOTS.map(slot => {
            const isSelected = horariosAtivos.includes(slot);
            return `
              <div class="time-slot-card ${isSelected ? 'active' : ''}" onclick="app.toggleTimeSlot('${slot}')">
                <input type="checkbox" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
                <span>${slot}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // TAB 4: MÓDULO DE RELATÓRIO DE VENDAS (ANALYTICS)
  renderTabRelatorios(analytics) {
    return `
      <!-- Filtro de Período do Relatório -->
      <div class="admin-card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h4 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 700;">Relatório de Desempenho</h4>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Métricas calculadas sobre pedidos pagos e entregues no período.</p>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <button class="admin-tab-btn ${this.reportPeriod === '7d' ? 'active' : ''}" onclick="app.setReportPeriod('7d')">Últimos 7 dias</button>
          <button class="admin-tab-btn ${this.reportPeriod === '30d' ? 'active' : ''}" onclick="app.setReportPeriod('30d')">Últimos 30 dias</button>
          <button class="admin-tab-btn ${this.reportPeriod === 'mes' ? 'active' : ''}" onclick="app.setReportPeriod('mes')">Mês Atual</button>
          <button class="admin-tab-btn ${this.reportPeriod === 'todos' ? 'active' : ''}" onclick="app.setReportPeriod('todos')">Todo o Período</button>
        </div>
      </div>

      <!-- Métricas Principais -->
      <div class="report-grid-summary">
        <div class="report-stat-card">
          <h5>FATURAMENTO TOTAL</h5>
          <div class="stat-val" style="color: var(--primary);">
            R$ ${analytics.totalFaturado.toFixed(2).replace('.', ',')}
          </div>
        </div>
        <div class="report-stat-card">
          <h5>PEDIDOS CONCLUÍDOS</h5>
          <div class="stat-val">${analytics.totalPedidos}</div>
        </div>
        <div class="report-stat-card">
          <h5>TICKET MÉDIO</h5>
          <div class="stat-val" style="color: var(--secondary);">
            R$ ${analytics.ticketMedio.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <!-- Ranking de Produtos Mais Vendidos & Melhores Clientes -->
      <div style="display: grid; grid-template-columns: 1fr; gap: 1.25rem;">
        <div class="admin-card">
          <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem;">
            🏆 Produtos Mais Vendidos
          </h4>
          ${analytics.topProdutos.length === 0 ? `
            <p style="color: var(--text-muted); font-size: 0.88rem;">Nenhuma venda registrada no período.</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${analytics.topProdutos.map((p, idx) => {
                const perc = Math.round((p.quantidade / analytics.maxProdQty) * 100);
                return `
                  <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.88rem; font-weight: 600; margin-bottom: 0.2rem;">
                      <span>#${idx + 1} ${p.nome}</span>
                      <span><strong>${p.quantidade} un.</strong> • R$ ${p.faturamento.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="progress-bar-wrap">
                      <div class="progress-bar-fill" style="width: ${perc}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div class="admin-card">
          <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem;">
            👑 Melhores Clientes (Moradores Mais Ativos)
          </h4>
          ${analytics.topClientes.length === 0 ? `
            <p style="color: var(--text-muted); font-size: 0.88rem;">Nenhum cliente registrado no período.</p>
          ` : `
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Localização</th>
                  <th>Pedidos</th>
                  <th>Total Gasto</th>
                </tr>
              </thead>
              <tbody>
                ${analytics.topClientes.slice(0, 10).map((c, idx) => `
                  <tr>
                    <td><strong>#${idx + 1} ${c.nome}</strong></td>
                    <td>Bloco ${c.bloco}, Apto ${c.apartamento}</td>
                    <td><strong>${c.pedidosCount}</strong></td>
                    <td style="color: var(--primary); font-weight: 700;">R$ ${c.totalGasto.toFixed(2).replace('.', ',')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- Vendas por Dia da Semana -->
        <div class="admin-card">
          <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem;">
            📅 Vendas por Dia da Semana
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 0.6rem;">
            ${analytics.vendasPorDia.map(d => `
              <div style="background: var(--bg-creme-alt); padding: 0.75rem; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle);">
                <small style="color: var(--text-muted); font-weight: 700; font-size: 0.75rem;">${d.dia}</small>
                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-dark); margin: 0.2rem 0;">${d.pedidos} ped.</div>
                <small style="color: var(--primary); font-weight: 700;">R$ ${d.total.toFixed(2).replace('.', ',')}</small>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // MODAL DE CADASTRO/EDIÇÃO DE PRODUTO COM UPLOAD DE IMAGEM REAL
  renderProductModal() {
    const p = this.productModalState;
    const isEdit = Boolean(p && p.id);

    return `
      <div class="modal-backdrop open">
        <div class="drawer-content" style="max-height: 95vh;">
          <div class="drawer-header">
            <h3 class="drawer-title">${isEdit ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h3>
            <button onclick="app.closeProductModal()" class="btn-close">&times;</button>
          </div>

          <form id="productForm">
            <div class="form-group">
              <label class="form-label" for="prodName">Nome do Produto / Sabor *</label>
              <input type="text" id="prodName" class="form-input" required value="${p.nome || ''}" placeholder="Ex: Gelatto de Doce de Leite com Nozes">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="prodPreco">Preço Unitário (R$) *</label>
                <input type="number" step="0.50" min="0" id="prodPreco" class="form-input" required value="${p.preco || '25.00'}">
              </div>
              <div class="form-group">
                <label class="form-label" for="prodEstoque">Estoque Inicial *</label>
                <input type="number" min="0" id="prodEstoque" class="form-input" required value="${p.estoque !== undefined ? p.estoque : 10}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="prodCategoria">Categoria</label>
              <select id="prodCategoria" class="form-select">
                <option value="Gelattos Artesanais" ${p.categoria === 'Gelattos Artesanais' ? 'selected' : ''}>Gelattos Artesanais</option>
                <option value="Doces & Bolos" ${p.categoria === 'Doces & Bolos' ? 'selected' : ''}>Doces & Bolos</option>
                <option value="Salgados Especiais" ${p.categoria === 'Salgados Especiais' ? 'selected' : ''}>Salgados Especiais</option>
                <option value="Caldos do Dia" ${p.categoria === 'Caldos do Dia' ? 'selected' : ''}>Caldos do Dia</option>
                <option value="Bebidas" ${p.categoria === 'Bebidas' ? 'selected' : ''}>Bebidas</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="prodDesc">Descrição Curta</label>
              <textarea id="prodDesc" class="form-textarea" rows="2" placeholder="Ingredientes especiais, textura, porção...">${p.descricao || ''}</textarea>
            </div>

            <!-- Upload de Imagem Ilustrativa / Real -->
            <div class="form-group">
              <label class="form-label">Foto Real do Produto (Upload)</label>
              <div class="image-upload-box" onclick="document.getElementById('productImageFile').click()">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--secondary); margin-bottom: 0.3rem;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <div style="font-size: 0.85rem; font-weight: 600;">Clique para escolher foto do celular ou computador</div>
                <small style="color: var(--text-muted); font-size: 0.75rem;">Formatos JPG, PNG ou WEBP</small>
              </div>
              <input type="file" id="productImageFile" accept="image/*" style="display: none;" onchange="app.handleImageUpload(event)">
              
              <div id="imagePreviewContainer" style="margin-top: 0.5rem; text-align: center;">
                <img id="imagePreview" src="${p.foto_url || 'assets/gelatto.jpg'}" class="image-preview-thumb" alt="Pré-visualização">
              </div>
              <input type="hidden" id="prodFotoUrl" value="${p.foto_url || 'assets/gelatto.jpg'}">
            </div>

            <button type="submit" class="btn-block btn-primary" style="margin-top: 1.25rem;">
              ${isEdit ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </button>
          </form>
        </div>
      </div>
    `;
  }

  openProductModal(productId = null) {
    if (productId) {
      const prod = this.produtos.find(p => p.id === productId);
      this.productModalState = prod ? { ...prod } : {};
    } else {
      this.productModalState = {
        nome: '',
        preco: 25.00,
        estoque: 10,
        categoria: 'Gelattos Artesanais',
        descricao: '',
        foto_url: 'assets/gelatto.jpg',
        ativo: true
      };
    }
    this.render();
  }

  closeProductModal() {
    this.productModalState = null;
    this.render();
  }

  handleImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Redimensiona inteligentemente via Canvas para alta resolução sem estourar o storage
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = Math.min(img.width, MAX_WIDTH);
        canvas.height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const previewElem = document.getElementById('imagePreview');
        const inputFotoUrl = document.getElementById('prodFotoUrl');
        if (previewElem) previewElem.src = dataUrl;
        if (inputFotoUrl) inputFotoUrl.value = dataUrl;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Setters de Filtros
  setAdminTab(tab) {
    this.adminActiveTab = tab;
    this.render();
  }

  setFilterDate(dateFilter) {
    this.adminFilterDate = dateFilter;
    this.render();
  }

  setCustomDate(dateVal) {
    this.adminCustomDate = dateVal;
    this.adminFilterDate = 'custom';
    this.render();
  }

  setSearchQuery(query) {
    this.adminSearchQuery = query;
    this.render();
  }

  setFilterStatus(status) {
    this.adminFilterStatus = status;
    this.render();
  }

  setReportPeriod(period) {
    this.reportPeriod = period;
    this.render();
  }

  promptSupabaseConfig() {
    const url = prompt('Cole a URL do seu Supabase (SUPABASE_URL):', window.AMOR_E_GELATTO_CONFIG.SUPABASE_URL || '');
    if (!url) return;
    const anonKey = prompt('Cole a chave anônima (SUPABASE_ANON_KEY):', window.AMOR_E_GELATTO_CONFIG.SUPABASE_ANON_KEY || '');
    if (!anonKey) return;

    localStorage.setItem('ag_supabase_url', url.trim());
    localStorage.setItem('ag_supabase_anon_key', anonKey.trim());
    window.location.reload();
  }

  // Event Listeners
  bindEvents() {
    window.addEventListener('hashchange', () => this.render());
  }

  bindDynamicEvents() {
    const btnOpenCart = document.getElementById('btnOpenCart');
    const btnCloseCart = document.getElementById('btnCloseCart');
    const cartModal = document.getElementById('cartModal');
    const btnGoToCheckout = document.getElementById('btnGoToCheckout');
    const btnProceedCheckout = document.getElementById('btnProceedCheckout');

    if (btnOpenCart && cartModal) {
      btnOpenCart.addEventListener('click', () => cartModal.classList.add('open'));
    }
    if (btnCloseCart && cartModal) {
      btnCloseCart.addEventListener('click', () => cartModal.classList.remove('open'));
    }
    if (btnGoToCheckout) {
      btnGoToCheckout.addEventListener('click', () => {
        window.location.hash = '#checkout';
      });
    }
    if (btnProceedCheckout) {
      btnProceedCheckout.addEventListener('click', () => {
        if (cartModal) cartModal.classList.remove('open');
        window.location.hash = '#checkout';
      });
    }

    const paymentCards = document.querySelectorAll('.payment-card');
    const selectedPaymentInput = document.getElementById('selectedPayment');
    paymentCards.forEach(card => {
      card.addEventListener('click', () => {
        paymentCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (selectedPaymentInput) {
          selectedPaymentInput.value = card.getAttribute('data-value');
        }
      });
    });

    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = checkoutForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Processando pedido com reserva...';
        }

        const formData = {
          nome: document.getElementById('clientName')?.value || '',
          whatsapp: document.getElementById('clientPhone')?.value || '',
          bloco: document.getElementById('clientBloco')?.value || '',
          apartamento: document.getElementById('clientApto')?.value || '',
          horario_desejado: document.getElementById('deliveryTime')?.value || '',
          observacoes: document.getElementById('clientObs')?.value || '',
          forma_pagamento: document.getElementById('selectedPayment')?.value || 'pix'
        };

        const pedido = await this.finalizarPedido(formData);
        if (pedido) {
          window.location.hash = `#pedido-${pedido.numero_pedido}`;
        } else if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Confirmar Pedido';
        }
      });
    }

    const btnCopyPix = document.getElementById('btnCopyPix');
    const pixKey = document.getElementById('pixKey');
    if (btnCopyPix && pixKey) {
      btnCopyPix.addEventListener('click', () => {
        navigator.clipboard.writeText(pixKey.innerText).then(() => {
          btnCopyPix.innerText = '✓ Chave Copiada!';
          setTimeout(() => { btnCopyPix.innerText = 'Copiar Chave Pix'; }, 2500);
        });
      });
    }

    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.adminLoggedIn = true;
        this.render();
      });
    }

    const btnAdminLogout = document.getElementById('btnAdminLogout');
    if (btnAdminLogout) {
      btnAdminLogout.addEventListener('click', () => {
        this.adminLoggedIn = false;
        window.location.hash = '';
      });
    }

    const btnToggleLoja = document.getElementById('btnToggleLoja');
    if (btnToggleLoja) {
      btnToggleLoja.addEventListener('click', () => this.toggleLojaStatus());
    }

    const btnSaveDeliveryMsg = document.getElementById('btnSaveDeliveryMsg');
    const adminDeliveryMsg = document.getElementById('adminDeliveryMsg');
    if (btnSaveDeliveryMsg && adminDeliveryMsg) {
      btnSaveDeliveryMsg.addEventListener('click', async () => {
        this.config.mensagem_entrega = adminDeliveryMsg.value.trim();
        this.save('ag_config', this.config);

        if (this.isSupabaseActive && this.supabase) {
          try {
            await this.supabase.from('loja_config').update({ mensagem_entrega: this.config.mensagem_entrega }).eq('id', 1);
          } catch (e) {
            console.warn('Erro ao atualizar mensagem de entrega no Supabase:', e);
          }
        }

        alert('Regra de entrega atualizada com sucesso!');
        this.render();
      });
    }

    const productForm = document.getElementById('productForm');
    if (productForm) {
      productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          nome: document.getElementById('prodName')?.value || '',
          preco: parseFloat(document.getElementById('prodPreco')?.value) || 0,
          estoque: parseInt(document.getElementById('prodEstoque')?.value) || 0,
          categoria: document.getElementById('prodCategoria')?.value || 'Gelattos Artesanais',
          descricao: document.getElementById('prodDesc')?.value || '',
          foto_url: document.getElementById('prodFotoUrl')?.value || 'assets/gelatto.jpg',
          ativo: this.productModalState ? (this.productModalState.ativo !== undefined ? this.productModalState.ativo : true) : true
        };

        if (this.productModalState && this.productModalState.id) {
          payload.id = this.productModalState.id;
        }

        await this.saveProduct(payload);
      });
    }
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new AmorEGelattoApp();
  window.app = app;
});
