const SESSAO = 'demo';

const conversa = document.getElementById('conversa');
const formulario = document.getElementById('formulario');
const entrada = document.getElementById('entrada');

const el = (id) => document.getElementById(id);
const dinheiro = (v) => `R$ ${Number(v ?? 0).toFixed(2).replace('.', ',')}`;

function agora() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function adicionarBalao(texto, autor, escalado = false) {
  const balao = document.createElement('div');
  balao.className = `balao ${autor}${escalado ? ' escalado' : ''}`;
  balao.textContent = texto;

  const hora = document.createElement('span');
  hora.className = 'hora';
  hora.textContent = agora();
  balao.appendChild(hora);

  conversa.appendChild(balao);
  conversa.scrollTop = conversa.scrollHeight;
}

function mostrarDigitando() {
  const bolha = document.createElement('div');
  bolha.className = 'digitando';
  bolha.id = 'digitando';
  bolha.innerHTML = '<i></i><i></i><i></i>';
  conversa.appendChild(bolha);
  conversa.scrollTop = conversa.scrollHeight;
}

function esconderDigitando() {
  document.getElementById('digitando')?.remove();
}

function atualizarPainel(pedido) {
  if (!pedido) return;

  const lista = el('listaItens');
  lista.innerHTML = '';

  if (!pedido.itens?.length) {
    lista.innerHTML = '<li class="vazio">Nenhum item ainda</li>';
  } else {
    for (const item of pedido.itens) {
      const li = document.createElement('li');
      li.innerHTML =
        `<span>${item.quantidade}x ${item.nome}</span>` +
        `<strong>${dinheiro(item.preco * item.quantidade)}</strong>`;
      lista.appendChild(li);
    }
  }

  el('subtotal').textContent = dinheiro(pedido.totais?.subtotal);
  el('taxa').textContent = dinheiro(pedido.totais?.taxaEntrega);
  el('total').textContent = dinheiro(pedido.totais?.total);
  el('modalidade').textContent = pedido.modalidade ?? '—';
  el('pagamento').textContent = pedido.pagamento ?? '—';

  el('pendencias').textContent = pedido.finalizado
    ? `confirmado ${pedido.numero ?? ''}`
    : (pedido.pendencias?.length ? pedido.pendencias.join(', ') : 'nada');
}

async function enviar(texto) {
  adicionarBalao(texto, 'cliente');
  mostrarDigitando();

  try {
    const resposta = await fetch('/api/mensagem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessaoId: SESSAO, texto }),
    });

    const dados = await resposta.json();
    esconderDigitando();

    if (!resposta.ok) {
      adicionarBalao(dados.erro ?? 'Erro ao enviar.', 'agente');
      return;
    }

    adicionarBalao(dados.resposta, 'agente', dados.escalado);
    atualizarPainel(dados.pedido);
  } catch {
    esconderDigitando();
    adicionarBalao('Sem conexão com o servidor. Ele está rodando?', 'agente');
  }
}

formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = entrada.value.trim();
  if (!texto) return;
  entrada.value = '';
  enviar(texto);
});

for (const botao of document.querySelectorAll('.sugestoes button')) {
  botao.addEventListener('click', () => enviar(botao.dataset.frase));
}

el('btnReiniciar').addEventListener('click', async () => {
  await fetch('/api/reiniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessaoId: SESSAO }),
  });
  conversa.innerHTML = '<div class="aviso-data"><span>HOJE</span></div>';
  atualizarPainel({ itens: [], totais: {}, pendencias: [] });
});

// Carrega dados do estabelecimento e ajusta o cabeçalho.
(async () => {
  try {
    const config = await (await fetch('/api/config')).json();
    const nome = config.estabelecimento.nome;

    el('nomeEstabelecimento').textContent = nome;
    el('avatar').textContent = nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    el('statusLinha').textContent = config.aberto ? 'online' : 'responde automaticamente';

    const selo = el('seloModo');
    const treinadas = config.cerebro?.situacoesTreino;
    selo.textContent = treinadas
      ? `CÉREBRO LOCAL · ${Math.round(treinadas / 1000)} mil situações`
      : 'CÉREBRO LOCAL';
    selo.classList.remove('mock');
    selo.title = config.cerebro
      ? `Treinado com ${treinadas.toLocaleString('pt-BR')} situações geradas de um espaço de ${config.cerebro.espacoCombinatorio.toLocaleString('pt-BR')} combinações. Sem API.`
      : '';
  } catch {
    el('nomeEstabelecimento').textContent = 'Servidor offline';
  }
})();
