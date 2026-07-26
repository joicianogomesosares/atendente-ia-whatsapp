/* =========================================================================
   ShopFlow - carrinho.js
   "A interface conversa, o codigo decide."
   Toda a matematica de dinheiro (subtotal, frete, cupom, total) e
   DETERMINISTICA e SEMPRE lida de window.PRODUTOS pelo id.
   Nunca lemos preco do DOM. O DOM apenas reflete o que o codigo calculou.
   Persistencia em localStorage. Sem rede, sem libs, vanilla puro.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     Constantes de negocio (contrato)
     ---------------------------------------------------------------------- */
  var CHAVE_CARRINHO = 'shopflow_carrinho'; // { "id": qtd, ... }
  var CHAVE_TEMA = 'shopflow_tema';         // 'claro' | 'escuro'

  var LIMITE_FRETE_GRATIS = 199;   // subtotal >= 199 => frete gratis
  var VALOR_FRETE = 19.9;          // caso contrario R$ 19,90

  // Cupons validos e o efeito de cada um.
  var CUPONS = {
    BEMVINDO10: { tipo: 'percentual', valor: 0.10, rotulo: '10% de desconto' },
    FRETEGRATIS: { tipo: 'frete', valor: 0, rotulo: 'Frete gratis' }
  };

  /* ----------------------------------------------------------------------
     Estado interno
     - itens: mapa id -> quantidade
     - cupom: codigo aplicado (string em maiusculas) ou null
     ---------------------------------------------------------------------- */
  var estado = {
    itens: {},
    cupom: null
  };

  /* ----------------------------------------------------------------------
     Utilitarios
     ---------------------------------------------------------------------- */

  // Formata numero como moeda pt-BR: 1234.56 -> "R$ 1.234,56"
  function formatarMoeda(valor) {
    var n = Number(valor) || 0;
    try {
      return n.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } catch (e) {
      // Fallback manual caso Intl nao esteja disponivel.
      var neg = n < 0 ? '-' : '';
      var abs = Math.abs(n).toFixed(2);
      var partes = abs.split('.');
      var inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return neg + 'R$ ' + inteiro + ',' + partes[1];
    }
  }

  // Busca um produto no catalogo global pelo id. Fonte unica da verdade.
  function acharProduto(id) {
    var lista = window.PRODUTOS || [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].id === id) return lista[i];
    }
    return null;
  }

  // Atalho de selecao de elemento.
  function $(sel) {
    return document.querySelector(sel);
  }

  // Arredonda para 2 casas evitando ruido de ponto flutuante.
  function arred2(v) {
    return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  }

  /* ----------------------------------------------------------------------
     Persistencia
     ---------------------------------------------------------------------- */
  function salvar() {
    try {
      var dados = { itens: estado.itens, cupom: estado.cupom };
      localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(dados));
    } catch (e) {
      /* localStorage pode falhar em modo privado; seguimos em memoria. */
    }
  }

  function carregar() {
    try {
      var bruto = localStorage.getItem(CHAVE_CARRINHO);
      if (!bruto) return;
      var dados = JSON.parse(bruto);
      if (dados && typeof dados === 'object') {
        // Sanitiza: so mantem entradas com quantidade inteira positiva.
        var itens = {};
        var origem = dados.itens || {};
        for (var id in origem) {
          if (Object.prototype.hasOwnProperty.call(origem, id)) {
            var q = parseInt(origem[id], 10);
            if (q > 0) itens[id] = q;
          }
        }
        estado.itens = itens;
        // So aceita cupom conhecido.
        estado.cupom = (dados.cupom && CUPONS[dados.cupom]) ? dados.cupom : null;
      }
    } catch (e) {
      estado.itens = {};
      estado.cupom = null;
    }
  }

  /* ----------------------------------------------------------------------
     Calculo DETERMINISTICO
     Retorna subtotal, desconto, frete, total e quantidade total de itens.
     ---------------------------------------------------------------------- */
  function totais() {
    var subtotal = 0;
    var qtdItens = 0;

    for (var id in estado.itens) {
      if (!Object.prototype.hasOwnProperty.call(estado.itens, id)) continue;
      var produto = acharProduto(id);
      if (!produto) continue; // produto sumiu do catalogo: ignora com seguranca
      var qtd = estado.itens[id];
      subtotal += Number(produto.preco) * qtd;
      qtdItens += qtd;
    }
    subtotal = arred2(subtotal);

    // Frete base pela regra do contrato.
    var frete = subtotal >= LIMITE_FRETE_GRATIS ? 0 : VALOR_FRETE;
    if (subtotal === 0) frete = 0; // carrinho vazio nao cobra frete

    // Desconto/efeito do cupom.
    var desconto = 0;
    var cupom = estado.cupom && CUPONS[estado.cupom] ? CUPONS[estado.cupom] : null;
    if (cupom) {
      if (cupom.tipo === 'percentual') {
        desconto = arred2(subtotal * cupom.valor);
      } else if (cupom.tipo === 'frete') {
        frete = 0;
      }
    }

    var total = arred2(subtotal - desconto + frete);
    if (total < 0) total = 0;

    return {
      subtotal: subtotal,
      desconto: desconto,
      frete: frete,
      total: total,
      quantidade: qtdItens
    };
  }

  // Lista detalhada dos itens (produto + qtd + subtotal da linha).
  function itens() {
    var lista = [];
    for (var id in estado.itens) {
      if (!Object.prototype.hasOwnProperty.call(estado.itens, id)) continue;
      var produto = acharProduto(id);
      if (!produto) continue;
      var qtd = estado.itens[id];
      lista.push({
        id: id,
        produto: produto,
        qtd: qtd,
        subtotalLinha: arred2(Number(produto.preco) * qtd)
      });
    }
    return lista;
  }

  /* ----------------------------------------------------------------------
     Operacoes de manipulacao
     ---------------------------------------------------------------------- */
  function adicionar(id, qtd) {
    qtd = parseInt(qtd, 10);
    if (!qtd || qtd < 1) qtd = 1;
    var produto = acharProduto(id);
    if (!produto) return; // id invalido: nada a fazer

    var atual = estado.itens[id] || 0;
    var novo = atual + qtd;

    // Respeita o estoque quando informado.
    if (typeof produto.estoque === 'number' && produto.estoque >= 0) {
      if (novo > produto.estoque) novo = produto.estoque;
    }
    if (novo < 1) return;

    estado.itens[id] = novo;
    salvar();
    render();
    animarContador();
    abrir(); // feedback: revela o carrinho ao adicionar
  }

  function remover(id) {
    if (estado.itens[id] != null) {
      delete estado.itens[id];
      salvar();
      render();
    }
  }

  function definirQtd(id, qtd) {
    qtd = parseInt(qtd, 10);
    if (isNaN(qtd) || qtd <= 0) {
      // Quantidade zero/invalida remove a linha.
      remover(id);
      return;
    }
    var produto = acharProduto(id);
    if (!produto) return;
    if (typeof produto.estoque === 'number' && produto.estoque >= 0) {
      if (qtd > produto.estoque) qtd = produto.estoque;
    }
    if (qtd < 1) {
      remover(id);
      return;
    }
    estado.itens[id] = qtd;
    salvar();
    render();
  }

  function limpar() {
    estado.itens = {};
    estado.cupom = null;
    salvar();
    render();
  }

  /* ----------------------------------------------------------------------
     Cupom
     ---------------------------------------------------------------------- */
  function aplicarCupom(codigo) {
    var entrada = codigo;
    // Se nao veio argumento, lemos do input de cupom.
    if (entrada == null) {
      var inp = $('#input-cupom');
      entrada = inp ? inp.value : '';
    }
    var cod = String(entrada || '').trim().toUpperCase();

    if (!cod) {
      feedbackCupom('Digite um codigo de cupom.', 'erro');
      return false;
    }
    if (!CUPONS[cod]) {
      estado.cupom = null;
      salvar();
      render();
      feedbackCupom('Cupom invalido: ' + cod + '.', 'erro');
      return false;
    }

    estado.cupom = cod;
    salvar();
    render();
    feedbackCupom('Cupom aplicado: ' + CUPONS[cod].rotulo + '.', 'sucesso');
    return true;
  }

  // Escreve feedback do cupom. Prefere um elemento dedicado; senao usa o resumo.
  function feedbackCupom(mensagem, tipo) {
    var alvo = document.getElementById('feedback-cupom');
    if (!alvo) {
      // Cria um paragrafo de feedback dentro do resumo, se possivel.
      var resumo = $('#resumo-carrinho');
      if (resumo) {
        alvo = document.getElementById('feedback-cupom');
        if (!alvo) {
          alvo = document.createElement('p');
          alvo.id = 'feedback-cupom';
          alvo.className = 'feedback-cupom';
          resumo.appendChild(alvo);
        }
      }
    }
    if (alvo) {
      alvo.textContent = mensagem;
      alvo.classList.remove('feedback-erro', 'feedback-sucesso');
      alvo.classList.add(tipo === 'erro' ? 'feedback-erro' : 'feedback-sucesso');
    }
  }

  /* ----------------------------------------------------------------------
     Renderizacao
     ---------------------------------------------------------------------- */

  // Reaproveita imagemProduto de loja.js quando disponivel; senao usa fallback.
  function imagemDe(produto) {
    if (window.Loja && typeof window.Loja.imagemProduto === 'function') {
      return window.Loja.imagemProduto(produto);
    }
    // Fallback minimo (SVG neutro) para nao quebrar caso loja.js ausente.
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
      '<rect width="80" height="80" fill="#ddd"/></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function render() {
    var t = totais();
    atualizarContador(t.quantidade);
    renderItens();
    renderResumo(t);
  }

  function atualizarContador(qtd) {
    var badge = $('#contador-carrinho');
    if (!badge) return;
    if (qtd == null) qtd = totais().quantidade;
    badge.textContent = String(qtd);
    // Esconde o badge quando vazio (deixa o CSS decidir via atributo/hidden).
    if (qtd > 0) {
      badge.removeAttribute('hidden');
      badge.classList.add('tem-itens');
    } else {
      badge.classList.remove('tem-itens');
      badge.setAttribute('hidden', 'hidden');
    }
  }

  // Micro-animacao ao adicionar (classe temporaria; CSS anima se quiser).
  function animarContador() {
    var badge = $('#contador-carrinho');
    if (!badge) return;
    badge.classList.remove('pulsar');
    // Forca reflow para reiniciar a animacao.
    void badge.offsetWidth;
    badge.classList.add('pulsar');
  }

  function renderItens() {
    var container = $('#itens-carrinho');
    if (!container) return;

    var linhas = itens();
    container.innerHTML = '';

    if (linhas.length === 0) {
      var vazio = document.createElement('p');
      vazio.className = 'carrinho-vazio';
      vazio.textContent = 'Seu carrinho esta vazio.';
      container.appendChild(vazio);
      return;
    }

    linhas.forEach(function (linha) {
      var p = linha.produto;
      var item = document.createElement('div');
      item.className = 'item-carrinho';
      item.setAttribute('data-id', linha.id);

      // Imagem
      var fig = document.createElement('img');
      fig.className = 'item-carrinho__img';
      fig.src = imagemDe(p);
      fig.alt = p.nome;
      fig.loading = 'lazy';

      // Info (nome + preco unitario)
      var info = document.createElement('div');
      info.className = 'item-carrinho__info';

      var nome = document.createElement('span');
      nome.className = 'item-carrinho__nome';
      nome.textContent = p.nome;

      var precoUn = document.createElement('span');
      precoUn.className = 'item-carrinho__preco-unit';
      precoUn.textContent = formatarMoeda(p.preco) + ' / un';

      info.appendChild(nome);
      info.appendChild(precoUn);

      // Controles de quantidade
      var controles = document.createElement('div');
      controles.className = 'item-carrinho__qtd';

      var btnMenos = document.createElement('button');
      btnMenos.type = 'button';
      btnMenos.className = 'qtd-btn qtd-menos';
      btnMenos.setAttribute('aria-label', 'Diminuir quantidade de ' + p.nome);
      btnMenos.textContent = '-';
      btnMenos.addEventListener('click', function () {
        definirQtd(linha.id, linha.qtd - 1);
      });

      var inpQtd = document.createElement('input');
      inpQtd.type = 'number';
      inpQtd.className = 'qtd-input';
      inpQtd.min = '1';
      inpQtd.value = String(linha.qtd);
      inpQtd.setAttribute('aria-label', 'Quantidade de ' + p.nome);
      inpQtd.addEventListener('change', function () {
        definirQtd(linha.id, inpQtd.value);
      });

      var btnMais = document.createElement('button');
      btnMais.type = 'button';
      btnMais.className = 'qtd-btn qtd-mais';
      btnMais.setAttribute('aria-label', 'Aumentar quantidade de ' + p.nome);
      btnMais.textContent = '+';
      btnMais.addEventListener('click', function () {
        definirQtd(linha.id, linha.qtd + 1);
      });

      controles.appendChild(btnMenos);
      controles.appendChild(inpQtd);
      controles.appendChild(btnMais);

      // Subtotal da linha + remover
      var direita = document.createElement('div');
      direita.className = 'item-carrinho__direita';

      var subLinha = document.createElement('span');
      subLinha.className = 'item-carrinho__subtotal';
      subLinha.textContent = formatarMoeda(linha.subtotalLinha);

      var btnRemover = document.createElement('button');
      btnRemover.type = 'button';
      btnRemover.className = 'item-carrinho__remover';
      btnRemover.setAttribute('aria-label', 'Remover ' + p.nome + ' do carrinho');
      btnRemover.textContent = 'Remover';
      btnRemover.addEventListener('click', function () {
        remover(linha.id);
      });

      direita.appendChild(subLinha);
      direita.appendChild(btnRemover);

      item.appendChild(fig);
      item.appendChild(info);
      item.appendChild(controles);
      item.appendChild(direita);

      container.appendChild(item);
    });
  }

  function renderResumo(t) {
    var resumo = $('#resumo-carrinho');
    if (!resumo) return;
    if (!t) t = totais();

    // Preserva um eventual feedback de cupom existente.
    var feedbackAtual = document.getElementById('feedback-cupom');
    var feedbackHTML = feedbackAtual ? feedbackAtual.outerHTML : '';

    var freteTexto = t.frete === 0
      ? '<span class="frete-gratis">Gratis</span>'
      : formatarMoeda(t.frete);

    var linhas = '';
    linhas += '<div class="resumo-linha"><span>Subtotal</span><span>' +
      formatarMoeda(t.subtotal) + '</span></div>';

    if (t.desconto > 0) {
      linhas += '<div class="resumo-linha resumo-desconto"><span>Desconto' +
        (estado.cupom ? ' (' + estado.cupom + ')' : '') +
        '</span><span>- ' + formatarMoeda(t.desconto) + '</span></div>';
    }

    linhas += '<div class="resumo-linha"><span>Frete</span><span>' +
      freteTexto + '</span></div>';

    linhas += '<div class="resumo-linha resumo-total"><span>Total</span><span>' +
      formatarMoeda(t.total) + '</span></div>';

    resumo.innerHTML = linhas + feedbackHTML;
  }

  /* ----------------------------------------------------------------------
     Drawer (gaveta lateral)
     ---------------------------------------------------------------------- */
  function abrir() {
    var drawer = $('#drawer-carrinho');
    if (!drawer) return;
    drawer.classList.add('aberto');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-aberto');
  }

  function fechar() {
    var drawer = $('#drawer-carrinho');
    if (!drawer) return;
    drawer.classList.remove('aberto');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-aberto');
    // Se o checkout estava aberto dentro do drawer, escondemos.
    var form = $('#form-checkout');
    if (form) form.hidden = true;
  }

  /* ----------------------------------------------------------------------
     Checkout
     - #btn-checkout revela #form-checkout
     - submit valida campos e mostra #tela-confirmacao com numero de pedido
     - numero derivado do estado (deterministico, sem Math.random)
     ---------------------------------------------------------------------- */

  function revelarCheckout() {
    var t = totais();
    if (t.quantidade === 0) {
      feedbackCupom('Adicione itens antes de finalizar a compra.', 'erro');
      return;
    }
    var form = $('#form-checkout');
    if (form) {
      form.hidden = false;
      // Foca o primeiro campo para acessibilidade.
      var primeiro = form.querySelector('[name="nome"]');
      if (primeiro) primeiro.focus();
    }
  }

  // Validacoes simples de cada campo do checkout.
  function validarCheckout(form) {
    var erros = [];

    var nome = (form.nome && form.nome.value || '').trim();
    var email = (form.email && form.email.value || '').trim();
    var cep = (form.cep && form.cep.value || '').trim();
    var endereco = (form.endereco && form.endereco.value || '').trim();
    var pagamento = (form.pagamento && form.pagamento.value || '').trim();

    if (nome.length < 3) erros.push('Informe seu nome completo.');

    var reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!reEmail.test(email)) erros.push('Informe um e-mail valido.');

    // CEP brasileiro: 00000-000 ou 8 digitos.
    var reCep = /^\d{5}-?\d{3}$/;
    if (!reCep.test(cep)) erros.push('CEP invalido. Use o formato 00000-000.');

    if (endereco.length < 5) erros.push('Informe o endereco de entrega.');

    if (!pagamento) erros.push('Escolha a forma de pagamento.');

    return erros;
  }

  // Gera um numero de pedido deterministico a partir do estado do carrinho.
  // Sem Math.random: mesmo carrinho -> mesmo numero. Formato #SF-XXXX.
  function gerarNumeroPedido() {
    var base = '';
    // Ordena ids para estabilidade.
    var ids = Object.keys(estado.itens).sort();
    ids.forEach(function (id) {
      base += id + ':' + estado.itens[id] + '|';
    });
    base += 'cupom=' + (estado.cupom || '') + '|';
    base += 'total=' + totais().total;

    // Hash simples (djb2) -> string base36 de 4 chars, em maiusculas.
    var hash = 5381;
    for (var i = 0; i < base.length; i++) {
      hash = ((hash << 5) + hash + base.charCodeAt(i)) >>> 0;
    }
    var cod = (hash % (36 * 36 * 36 * 36)).toString(36).toUpperCase();
    while (cod.length < 4) cod = '0' + cod;
    return '#SF-' + cod;
  }

  function finalizar(evt) {
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();

    var form = $('#form-checkout');
    if (!form) return;

    var t = totais();
    if (t.quantidade === 0) {
      feedbackCupom('Seu carrinho esta vazio.', 'erro');
      return;
    }

    var erros = validarCheckout(form);
    if (erros.length > 0) {
      mostrarErrosCheckout(form, erros);
      return;
    }

    // Sucesso: numero de pedido deterministico calculado ANTES de limpar.
    var numero = gerarNumeroPedido();
    var totalTexto = formatarMoeda(t.total);

    mostrarConfirmacao(numero, totalTexto);

    // Limpa carrinho e formulario apos concluir.
    limpar();
    if (typeof form.reset === 'function') form.reset();
    form.hidden = true;
  }

  function mostrarErrosCheckout(form, erros) {
    var alvo = form.querySelector('#erros-checkout');
    if (!alvo) {
      alvo = document.createElement('div');
      alvo.id = 'erros-checkout';
      alvo.className = 'erros-checkout';
      alvo.setAttribute('role', 'alert');
      form.insertBefore(alvo, form.firstChild);
    }
    alvo.innerHTML = '<ul>' + erros.map(function (e) {
      return '<li>' + e + '</li>';
    }).join('') + '</ul>';
  }

  function mostrarConfirmacao(numero, totalTexto) {
    var tela = $('#tela-confirmacao');
    if (!tela) return;
    tela.innerHTML =
      '<div class="confirmacao-conteudo">' +
      '<div class="confirmacao-check" aria-hidden="true">&#10003;</div>' +
      '<h2>Pedido confirmado!</h2>' +
      '<p>Obrigado pela compra. Seu pedido foi registrado com sucesso.</p>' +
      '<p class="confirmacao-numero">Numero do pedido: <strong>' + numero + '</strong></p>' +
      '<p class="confirmacao-total">Valor total: <strong>' + totalTexto + '</strong></p>' +
      '<button type="button" id="btn-continuar-comprando" class="btn-primario">Continuar comprando</button>' +
      '</div>';
    tela.hidden = false;
    tela.classList.add('visivel');

    var btn = tela.querySelector('#btn-continuar-comprando');
    if (btn) {
      btn.addEventListener('click', function () {
        tela.hidden = true;
        tela.classList.remove('visivel');
        fechar();
      });
      btn.focus();
    }
  }

  /* ----------------------------------------------------------------------
     Tema (claro/escuro)
     - #toggle-tema alterna [data-tema] no <html>
     - salva em localStorage; primeiro load respeita prefers-color-scheme
     ---------------------------------------------------------------------- */
  function aplicarTema(tema) {
    var html = document.documentElement;
    if (tema === 'escuro') {
      html.setAttribute('data-tema', 'escuro');
    } else {
      html.setAttribute('data-tema', 'claro');
    }
    // Atualiza o rotulo/estado do botao para acessibilidade.
    var btn = $('#toggle-tema');
    if (btn) {
      var escuro = tema === 'escuro';
      btn.setAttribute('aria-pressed', escuro ? 'true' : 'false');
      btn.setAttribute('aria-label', escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro');
      btn.setAttribute('title', escuro ? 'Tema escuro ativo' : 'Tema claro ativo');
    }
  }

  function temaInicial() {
    var salvo = null;
    try {
      salvo = localStorage.getItem(CHAVE_TEMA);
    } catch (e) { /* ignora */ }

    if (salvo === 'claro' || salvo === 'escuro') {
      return salvo;
    }
    // Sem preferencia salva: respeita o sistema no primeiro load.
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'escuro';
    }
    return 'claro';
  }

  function alternarTema() {
    var atual = document.documentElement.getAttribute('data-tema') === 'escuro'
      ? 'escuro' : 'claro';
    var novo = atual === 'escuro' ? 'claro' : 'escuro';
    aplicarTema(novo);
    try {
      localStorage.setItem(CHAVE_TEMA, novo);
    } catch (e) { /* ignora */ }
  }

  /* ----------------------------------------------------------------------
     Ligacao de eventos do DOM
     ---------------------------------------------------------------------- */
  function ligarEventos() {
    var btnAbrir = $('#btn-abrir-carrinho');
    if (btnAbrir) btnAbrir.addEventListener('click', abrir);

    var btnFechar = $('#fechar-carrinho');
    if (btnFechar) btnFechar.addEventListener('click', fechar);

    // Clicar fora do painel do drawer fecha (overlay).
    var drawer = $('#drawer-carrinho');
    if (drawer) {
      drawer.addEventListener('click', function (e) {
        if (e.target === drawer) fechar();
      });
    }

    // Esc fecha o drawer.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fechar();
    });

    var btnCupom = $('#btn-cupom');
    if (btnCupom) {
      btnCupom.addEventListener('click', function () {
        aplicarCupom();
      });
    }
    var inpCupom = $('#input-cupom');
    if (inpCupom) {
      inpCupom.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          aplicarCupom();
        }
      });
    }

    var btnCheckout = $('#btn-checkout');
    if (btnCheckout) btnCheckout.addEventListener('click', revelarCheckout);

    var form = $('#form-checkout');
    if (form) {
      form.hidden = true; // comeca escondido ate clicar em finalizar
      form.addEventListener('submit', finalizar);
    }

    var tela = $('#tela-confirmacao');
    if (tela) tela.hidden = true;

    var btnTema = $('#toggle-tema');
    if (btnTema) btnTema.addEventListener('click', alternarTema);
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */
  function iniciar() {
    // Tema o quanto antes para evitar "flash" do tema errado.
    aplicarTema(temaInicial());

    carregar();
    ligarEventos();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  /* ----------------------------------------------------------------------
     API publica (contrato)
     ---------------------------------------------------------------------- */
  window.Carrinho = {
    adicionar: adicionar,
    remover: remover,
    definirQtd: definirQtd,
    aplicarCupom: aplicarCupom,
    limpar: limpar,
    itens: itens,
    totais: totais,
    render: render,
    abrir: abrir,
    fechar: fechar,
    finalizar: finalizar,
    // Exposto por conveniencia para outros modulos formatarem moeda igual.
    formatarMoeda: formatarMoeda
  };
})();
