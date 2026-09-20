# BRIEF.md — Loja de Pronta Entrega do Condomínio

## 1. Contexto

Este projeto é uma loja digital simples para venda de alimentos de pronta entrega produzidos em casa, exclusivamente para moradores de um condomínio.

Os produtos são feitos antes da venda em quantidades limitadas e anunciados em um grupo de WhatsApp. Exemplos:

- Fatias individuais de bolo
- Empadões
- Caldos
- Outros alimentos preparados no dia

O objetivo é substituir o atendimento manual repetitivo no WhatsApp por uma página de compra rápida, responsiva e muito simples de usar no celular.

O WhatsApp continuará sendo usado para divulgar a abertura da loja e como canal de suporte, mas o pedido deverá ser feito no sistema.

## 2. Objetivo principal

Permitir que um morador:

1. Acesse um link enviado no grupo de WhatsApp.
2. Veja somente os produtos disponíveis naquele momento.
3. Escolha produtos e quantidades.
4. Informe nome, WhatsApp, bloco e apartamento.
5. Escolha a forma de pagamento.
6. Informe o horário desejado para receber o pedido.
7. Finalize o pedido.
8. Receba uma confirmação clara e possa abrir o WhatsApp com o resumo preenchido.

Permitir que a administradora:

1. Abra ou feche a loja manualmente.
2. Cadastre e altere produtos disponíveis para a venda atual.
3. Controle preço e estoque por produto.
4. Veja e administre os pedidos.
5. Atualize o status de pagamento, produção e entrega.
6. Consulte rapidamente bloco, apartamento, forma de pagamento e horário desejado.
7. Evite vender mais unidades do que as produzidas.

## 3. Público e área de entrega

- Público exclusivo: moradores do condomínio.
- Não haverá entrega externa, frete, cálculo por CEP ou área de cobertura pública.
- O formulário de entrega não deve solicitar rua, bairro, cidade ou CEP.
- Dados obrigatórios de entrega: bloco e apartamento.
- Campo de referência ou observação é opcional.

## 4. Modelo de venda

- A venda é de pronta entrega.
- A administradora produzirá uma quantidade limitada antes de abrir a loja.
- A administradora cadastrará os produtos, preços e estoques manualmente.
- Cada sabor ou produto deve ser um item separado.
- Exemplo:
  - Fatia de bolo de cenoura com cobertura: estoque 12.
  - Fatia de bolo de chocolate: estoque 8.
  - Empadão de frango: estoque 5.
- Os produtos são vendidos principalmente por unidade.
- O cliente define a quantidade desejada de cada produto.
- Não implementar, na primeira versão, variações complexas, adicionais, tamanhos dentro do mesmo produto, cupons, fidelidade ou encomenda futura.

## 5. Regras da loja

### Loja aberta e fechada

- A administradora deve ter um controle visível e simples para abrir ou fechar a loja.
- Apenas lojas abertas podem receber novos pedidos.
- Quando a loja estiver fechada:
  - Exibir uma página amigável com a mensagem “A loja está fechada no momento”.
  - Informar que os produtos são anunciados no grupo de WhatsApp quando houver nova venda.
  - Não permitir adicionar ao carrinho nem concluir pedido.
- Fechar a loja não deve apagar pedidos existentes nem impedir a administração de pedidos já feitos.

### Estoque e disponibilidade

- Cada produto deve ter estoque independente.
- O sistema não pode permitir vender uma quantidade superior ao estoque disponível.
- Se o estoque chegar a zero, o produto deve ficar marcado como “Esgotado” ou ser ocultado conforme configuração da administradora.
- O carrinho deve validar novamente estoque e status da loja antes de criar o pedido.
- A criação de pedido e a baixa/reserva de estoque devem ocorrer de maneira segura e atômica no servidor/banco de dados, evitando que dois clientes comprem a última unidade ao mesmo tempo.
- Nunca confiar somente no estoque exibido no navegador.

### Reserva para Pix

- Quando a forma de pagamento escolhida for Pix:
  - Criar o pedido com status `aguardando_pagamento_pix`.
  - Reservar o estoque dos itens por padrão durante 15 minutos.
  - Exibir uma contagem regressiva clara na página de confirmação.
  - Exibir chave Pix configurável e o valor total do pedido.
  - Exibir botão para copiar a chave Pix.
  - Permitir que a administradora marque manualmente o pedido como pago.
  - Quando marcado como pago, o pedido muda para `pago`.
  - Se o prazo expirar sem confirmação, cancelar automaticamente o pedido e devolver as unidades ao estoque.
  - A duração de reserva deve ser configurável no painel administrativo.
- A primeira versão não precisa de geração automática de cobrança Pix nem confirmação automática por webhook.
- Estruturar o projeto para permitir integração futura de Pix automático por provedor de pagamento e webhook.
- Não expor chaves secretas de qualquer provedor de pagamento no front-end.

### Dinheiro ou cartão na entrega

- Formas disponíveis:
  - Pix.
  - Dinheiro na entrega.
  - Cartão na entrega.
- Dinheiro e cartão na entrega devem poder ser ativados ou desativados pela administradora para cada abertura de loja.
- Para essas formas, criar pedido com status `confirmado_pagamento_na_entrega`.
- O estoque deve ser imediatamente reservado/baixado quando o pedido for criado.
- A administradora poderá cancelar o pedido; ao cancelar, o estoque deve retornar.
- Para cartão na entrega, não haverá pagamento online nem armazenamento de dados de cartão.
- Não solicitar, processar ou armazenar número de cartão, CVV ou qualquer dado sensível de cartão.

## 6. Entrega

A administradora define, em cada abertura de loja, o texto/regra de entrega exibido ao cliente. Exemplos:

- “Entregas imediatas enquanto houver disponibilidade.”
- “Entregas a partir das 17h.”
- “Entregas sob demanda.”
- “Pedidos serão entregues entre 18h e 20h.”

No checkout:

- Exibir a regra de entrega ativa antes da confirmação.
- Oferecer campo obrigatório `horario_desejado_entrega`.
- O cliente pode informar um horário aproximado em que estará em casa.
- Deixar explícito no texto: “O horário é uma preferência e será atendido conforme a rota e a disponibilidade.”
- Permitir opção “Assim que possível” como padrão.
- Não criar agenda complexa, cálculo automático de rota ou garantia automática de horário na primeira versão.

## 7. Jornada do cliente

1. Cliente recebe o link da loja no grupo de WhatsApp.
2. Cliente abre o link no celular.
3. Cliente vê aviso de loja aberta e regra de entrega do dia.
4. Cliente visualiza produtos disponíveis, foto, nome, descrição curta, preço, quantidade disponível e botão para adicionar ao carrinho.
5. Cliente adiciona um ou mais produtos e quantidades.
6. Cliente revisa o carrinho.
7. Cliente informa:
   - Nome completo.
   - Número de WhatsApp.
   - Bloco.
   - Apartamento.
   - Horário desejado para entrega.
   - Observações, opcional.
8. Cliente escolhe uma forma de pagamento disponível.
9. Cliente confirma o pedido.
10. O sistema valida loja aberta, estoque e dados obrigatórios no servidor.
11. O sistema gera número único do pedido e registra a compra.
12. O cliente vê uma página de confirmação adequada à forma de pagamento.
13. A página oferece botão “Enviar resumo pelo WhatsApp”.
14. O botão abre o WhatsApp da vendedora com uma mensagem preenchida contendo número do pedido, itens, total, pagamento, bloco, apartamento e horário desejado.
15. Para Pix, o cliente vê chave Pix, total e contagem regressiva da reserva.
16. Para dinheiro/cartão na entrega, o cliente vê confirmação de que o pedido foi reservado e que o pagamento ocorrerá na entrega.

## 8. Jornada administrativa

A administradora acessa um painel protegido por login e consegue:

- Abrir e fechar a loja.
- Definir mensagem/regra de entrega do dia.
- Definir prazo de reserva do Pix.
- Ativar ou desativar Pix, dinheiro na entrega e cartão na entrega.
- Cadastrar, editar, ativar, desativar e excluir produtos.
- Cadastrar foto, nome, descrição, preço e estoque de cada produto.
- Ajustar estoque rapidamente.
- Ver produtos esgotados.
- Consultar pedidos por status, data e apartamento.
- Ver detalhes completos de cada pedido.
- Alterar status dos pedidos.
- Cancelar pedido com devolução correta de estoque.
- Marcar Pix manualmente como pago.
- Registrar entrega concluída.
- Ver uma lista simples de pedidos de hoje para separação e entrega.
- Visualizar totais básicos: quantidade de pedidos, total vendido, pendente de Pix e itens mais vendidos.

## 9. Status de pedido

Implementar no mínimo estes status:

- `aguardando_pagamento_pix`
- `pago`
- `confirmado_pagamento_na_entrega`
- `em_separacao`
- `saiu_para_entrega`
- `entregue`
- `cancelado`
- `expirado`

Regras:

- `aguardando_pagamento_pix` expira automaticamente após o prazo configurado.
- `pago` significa Pix confirmado manualmente pela administradora nesta primeira versão.
- `confirmado_pagamento_na_entrega` significa pedido confirmado, com pagamento pendente para entrega.
- `cancelado` e `expirado` devolvem ao estoque os itens ainda reservados, exatamente uma vez.
- O histórico de mudanças de status deve ser preservado.
- Não permitir transições inválidas ou devolução dupla de estoque.

## 10. Interface e experiência

- Interface em português do Brasil.
- Prioridade absoluta para celular, pois o acesso ocorrerá pelo link divulgado em grupo de WhatsApp.
- Design simples, acolhedor, limpo e orientado a alimentos artesanais.
- Navegação curta: produtos → carrinho → checkout → confirmação.
- Botões grandes, campos fáceis de preencher e contraste adequado.
- Informar claramente:
  - Loja aberta ou fechada.
  - Regra de entrega atual.
  - Disponibilidade/estoque.
  - Valor total.
  - Forma de pagamento.
  - Prazo de reserva Pix.
- Não exigir cadastro, senha ou login do cliente.
- Painel administrativo com login seguro e separado da área pública.
- Páginas públicas não devem permitir editar produtos, estoques, preços ou status.

## 11. Integração com WhatsApp

Na primeira versão:

- Não usar WhatsApp Business API.
- Não usar chatbot nem automação de mensagens.
- Gerar botão de WhatsApp ao final do pedido usando link oficial click-to-chat.
- O telefone da vendedora deve ser configurável no painel ou variável de ambiente.
- A mensagem deve ser preenchida automaticamente com dados do pedido.
- Exemplo de texto:

  Olá! Acabei de fazer o pedido nº {numero_pedido}.

  Itens:
  {itens_do_pedido}

  Total: R$ {valor_total}
  Pagamento: {forma_pagamento}
  Entrega: Bloco {bloco}, apartamento {apartamento}
  Horário desejado: {horario_desejado}

  Obrigado(a)!

## 12. Dados e privacidade

Dados coletados:

- Nome.
- Número de WhatsApp.
- Bloco.
- Apartamento.
- Itens do pedido.
- Valor.
- Forma de pagamento.
- Status do pedido.
- Horário desejado de entrega.
- Observação opcional.

Regras:

- Coletar somente os dados necessários para atender o pedido.
- Não coletar CPF, RG, data de nascimento, dados de cartão ou endereço externo.
- Proteger o painel administrativo com autenticação.
- Proteger banco e tabelas com políticas de acesso.
- Não expor chaves de serviço, tokens privados ou credenciais no front-end.
- Criar uma página curta de privacidade/uso de dados, explicando que os dados são usados apenas para processar e entregar o pedido no condomínio.

## 13. Arquitetura técnica desejada

Construir um MVP web responsivo, com possibilidade de instalar como atalho/PWA posteriormente.

Sugestão preferencial, sujeita à validação técnica:

- Front-end: Next.js com TypeScript.
- Estilo: Tailwind CSS e componentes acessíveis.
- Banco, autenticação, armazenamento de imagens e funções de servidor: Supabase.
- Hospedagem: Vercel ou alternativa simples equivalente.
- Banco de dados: PostgreSQL via Supabase.
- Login administrativo: Supabase Auth.
- Lógica crítica de criação, reserva, expiração e devolução de estoque: funções server-side / Edge Functions ou rotinas SQL transacionais.
- Agendador para expirar reservas Pix: recurso de cron/agenda seguro do backend.
- Link WhatsApp: `wa.me` com mensagem URL-encoded.
- Variáveis de ambiente para URL do Supabase, chaves públicas, telefone comercial e futuras credenciais de pagamento.

A escolha técnica final deve priorizar segurança, custo baixo, simplicidade de manutenção e confiabilidade do estoque.

## 14. Segurança e qualidade

- Implementar validação de dados no cliente e no servidor.
- Sanitizar todas as entradas de texto.
- Aplicar proteção contra abuso no endpoint de criação de pedido, incluindo rate limiting ou mecanismo equivalente.
- Não expor chaves administrativas no navegador.
- Ativar Row Level Security no banco de dados e criar políticas com menor privilégio necessário.
- Utilizar operações atômicas/transacionais para estoque, reserva e cancelamento.
- Testar cenários de concorrência para o último item em estoque.
- Testar expiração de Pix e retorno de estoque.
- Testar cancelamento e evitar retorno duplicado de estoque.
- Testar funcionamento em tela de celular.
- Criar mensagens de erro claras para estoque insuficiente, loja fechada e pedido expirado.
- Não iniciar integração de pagamento real sem ambiente de teste e confirmação explícita.

## 15. Fora do escopo inicial

Não implementar na primeira versão:

- Delivery fora do condomínio.
- Taxa de entrega ou cálculo de frete.
- Login do cliente.
- Integração com API oficial do WhatsApp.
- Chatbot.
- Atendimento por IA.
- Pix automático.
- Cartão online.
- Dados de cartão.
- Cupons.
- Programa de pontos/fidelidade.
- Agendamento complexo de horários.
- Múltiplos usuários administradores.
- Marketplace.
- Integração com iFood.
- Relatórios financeiros avançados.
- Notificações automáticas por WhatsApp.
- Aplicativo nativo para Android ou iOS.

## 16. Critérios de aceite do MVP

O MVP estará pronto quando:

1. A administradora conseguir abrir e fechar a loja.
2. A administradora conseguir cadastrar produtos com preço, foto e estoque.
3. Um cliente conseguir fazer um pedido no celular sem criar conta.
4. O sistema impedir pedido quando a loja estiver fechada.
5. O sistema impedir venda acima do estoque disponível.
6. O sistema reservar unidades em pedidos Pix e devolvê-las após expiração.
7. O sistema reservar unidades em pedidos com pagamento na entrega.
8. A administradora conseguir confirmar Pix, cancelar pedido e registrar entrega.
9. O cliente conseguir informar bloco, apartamento e horário desejado.
10. O botão de WhatsApp gerar mensagem preenchida com resumo correto do pedido.
11. As informações administrativas não puderem ser acessadas ou alteradas publicamente.
12. A experiência estiver adequada para uso em celular.