// Estado do pedido — deliberadamente FORA do LLM.
//
// Regra de ouro do projeto: o modelo conversa, o código calcula.
// Toda soma, validação e fechamento de pedido acontece aqui, de forma
// determinística. LLM que calcula total erra em algum momento, e errar
// dinheiro na frente do cliente destrói a confiança na solução inteira.

import { buscarItem, ESTABELECIMENTO } from './cardapio.js';

const pedidos = new Map();

export function obterPedido(sessaoId) {
  if (!pedidos.has(sessaoId)) {
    pedidos.set(sessaoId, {
      sessaoId,
      itens: [],
      modalidade: null, // 'entrega' | 'retirada'
      endereco: null,
      pagamento: null,
      finalizado: false,
      criadoEm: new Date().toISOString(),
    });
  }
  return pedidos.get(sessaoId);
}

export function adicionarItem(sessaoId, termo, quantidade = 1) {
  const item = buscarItem(termo);
  if (!item) return { ok: false, motivo: `Não encontrei "${termo}" no cardápio.` };

  const qtd = Number.isFinite(quantidade) && quantidade > 0 ? Math.floor(quantidade) : 1;
  const pedido = obterPedido(sessaoId);
  const existente = pedido.itens.find((i) => i.id === item.id);

  if (existente) existente.quantidade += qtd;
  else pedido.itens.push({ id: item.id, nome: item.nome, preco: item.preco, quantidade: qtd });

  return { ok: true, item: item.nome, quantidade: qtd };
}

export function removerItem(sessaoId, termo) {
  const item = buscarItem(termo);
  if (!item) return { ok: false, motivo: `Não encontrei "${termo}" no pedido.` };

  const pedido = obterPedido(sessaoId);
  const antes = pedido.itens.length;
  pedido.itens = pedido.itens.filter((i) => i.id !== item.id);

  return pedido.itens.length < antes
    ? { ok: true, item: item.nome }
    : { ok: false, motivo: `${item.nome} não estava no pedido.` };
}

export function definirModalidade(sessaoId, modalidade, endereco = null) {
  const pedido = obterPedido(sessaoId);
  pedido.modalidade = modalidade === 'entrega' ? 'entrega' : 'retirada';
  pedido.endereco = pedido.modalidade === 'entrega' ? endereco : null;
  return pedido;
}

export function definirPagamento(sessaoId, forma) {
  const pedido = obterPedido(sessaoId);
  pedido.pagamento = forma;
  return pedido;
}

export function calcularTotais(pedido) {
  const subtotal = pedido.itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const taxaEntrega = pedido.modalidade === 'entrega' ? ESTABELECIMENTO.entrega.taxa : 0;
  return { subtotal, taxaEntrega, total: subtotal + taxaEntrega };
}

/** O que ainda falta para o pedido poder ser fechado. */
export function pendencias(pedido) {
  const faltando = [];
  if (pedido.itens.length === 0) faltando.push('itens');
  if (!pedido.modalidade) faltando.push('entrega ou retirada');
  if (pedido.modalidade === 'entrega' && !pedido.endereco) faltando.push('endereço');
  if (!pedido.pagamento) faltando.push('forma de pagamento');
  return faltando;
}

/** Resumo formatado — é o que a cozinha recebe e o que o cliente confirma. */
export function resumoPedido(pedido) {
  if (pedido.itens.length === 0) return 'Pedido vazio.';

  const { subtotal, taxaEntrega, total } = calcularTotais(pedido);
  const linhas = pedido.itens.map(
    (i) => `${i.quantidade}x ${i.nome} — R$ ${(i.preco * i.quantidade).toFixed(2)}`
  );

  const partes = [
    '*RESUMO DO PEDIDO*',
    linhas.join('\n'),
    '',
    `Subtotal: R$ ${subtotal.toFixed(2)}`,
  ];

  if (taxaEntrega > 0) partes.push(`Taxa de entrega: R$ ${taxaEntrega.toFixed(2)}`);
  partes.push(`*Total: R$ ${total.toFixed(2)}*`);

  if (pedido.modalidade === 'entrega') {
    partes.push('', `Entrega em: ${pedido.endereco ?? '(endereço pendente)'}`);
    partes.push(`Previsão: ${ESTABELECIMENTO.entrega.tempoMedio}`);
  } else if (pedido.modalidade === 'retirada') {
    partes.push('', `Retirada no balcão — pronto em ${ESTABELECIMENTO.retirada.tempoMedio}`);
  }

  if (pedido.pagamento) partes.push(`Pagamento: ${pedido.pagamento}`);

  return partes.join('\n');
}

export function finalizarPedido(sessaoId) {
  const pedido = obterPedido(sessaoId);
  const faltando = pendencias(pedido);
  if (faltando.length > 0) return { ok: false, faltando };

  pedido.finalizado = true;
  pedido.numero = `#${String(pedidos.size).padStart(4, '0')}`;
  return { ok: true, pedido, resumo: resumoPedido(pedido) };
}

export function reiniciar(sessaoId) {
  pedidos.delete(sessaoId);
}
