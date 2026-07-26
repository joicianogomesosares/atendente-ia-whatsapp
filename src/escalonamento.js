// Escalonamento para atendente humano.
//
// Este é o módulo que separa um chatbot que o cliente ama de um que ele odeia.
// A regra de projeto: TODO caminho sem saída termina num humano, nunca num
// robô repetindo a mesma frase. Três gatilhos, em ordem de urgência:
//
//   1. SEGURANÇA (alergia, passou mal) — escala na hora E congela o pedido.
//      O custo de um falso positivo é um pedido atrasado; o custo de um falso
//      negativo é alguém no hospital. Não há trade-off a discutir.
//   2. Pedido explícito de humano / assunto sensível — escala na hora.
//      Cliente que pediu gente e recebeu robô já está contando até dez.
//   3. Robô travado — 2 fallbacks seguidos escalam. Não 3: a terceira
//      repetição é exatamente o que denuncia a máquina.
//
// Fora do horário não existe humano para receber. Decisão: escalar mesmo
// assim e ser honesto sobre o prazo — segurar o cliente no robô para "não
// perder pedido" é o tipo de esperteza que vira avaliação de 1 estrela.

import { preparar, tokenizar, tokenParece } from './nlu/normalizador.js';

/** Palavras que sinalizam pedido explícito de humano. */
export const PEDIDOS_DE_HUMANO = [
  'atendente', 'humano', 'gerente', 'responsavel',
  'falar com alguem', 'falar com uma pessoa', 'pessoa de verdade',
  'atendimento humano', 'me liga', 'quero gente',
];

/** Assuntos que o robô não tem autoridade para resolver sozinho. */
export const ASSUNTOS_SENSIVEIS = [
  'reclamacao', 'reembolso', 'estorno', 'dinheiro de volta', 'cancelar pedido',
  'veio errado', 'veio frio', 'chegou frio', 'chegou errado', 'veio faltando',
  'atrasado', 'atrasou', 'cade meu pedido', 'onde esta meu pedido',
  'demorando muito', 'ja faz', 'procon', 'advogado', 'processo', 'reclame aqui',
  'absurdo', 'pessimo', 'horrivel', 'nunca mais', 'descaso',
];

/** Segurança: qualquer menção escala e congela o pedido. */
export const SEGURANCA = [
  'alergia', 'alergico', 'alergica', 'intolerancia', 'intolerante',
  'passei mal', 'passou mal', 'passando mal', 'intoxicacao', 'intoxicado',
  'hospital', 'anafilaxia', 'reacao alergica', 'celiaco', 'celiaca',
];

const PALAVROES = ['merda', 'porra', 'caralho', 'bosta', 'lixo', 'palhacada', 'incompetente'];

export function normalizar(texto) {
  return preparar(texto);
}

/** O texto contém algum termo da lista (com tolerância a typo em palavra única)? */
export function contemAlgum(texto, lista) {
  const t = preparar(texto);
  const tokens = tokenizar(texto);
  return lista.some((termo) => {
    if (termo.includes(' ')) return t.includes(termo);
    return tokens.some((tok) => tokenParece(tok, termo));
  });
}

/**
 * Decide se a conversa deve sair do robô e ir para um humano.
 *
 * @returns {{escalar: boolean, motivo: string|null, mensagem: string|null,
 *            congelarPedido?: boolean}}
 */
export function avaliarEscalonamento({ mensagem, tentativasSemEntender = 0 }) {
  // 1. Segurança primeiro. Congela o pedido: o bug histórico deste projeto
  //    foi adicionar Quatro Queijos ao carrinho de quem disse "alergia a
  //    lactose" — o congelamento garante que isso nunca mais acontece.
  if (contemAlgum(mensagem, SEGURANCA)) {
    return { escalar: true, motivo: 'seguranca', mensagem: null, congelarPedido: true };
  }

  // 2a. Pedido explícito de humano.
  if (contemAlgum(mensagem, PEDIDOS_DE_HUMANO)) {
    return { escalar: true, motivo: 'pedido_explicito', mensagem: null };
  }

  // 2b. Assunto sensível ou cliente já alterado.
  if (contemAlgum(mensagem, ASSUNTOS_SENSIVEIS) || contemAlgum(mensagem, PALAVROES)) {
    return { escalar: true, motivo: 'assunto_sensivel', mensagem: null };
  }

  // 3. Robô travado: no segundo "não entendi" seguido, um humano assume.
  if (tentativasSemEntender >= 2) {
    return { escalar: true, motivo: 'agente_travado', mensagem: null };
  }

  return { escalar: false, motivo: null, mensagem: null };
}

/** Texto mostrado ao cliente quando a conversa é escalada. */
export function mensagemDeEscalonamento(motivo, dentroDoHorario) {
  const base = {
    pedido_explicito: 'Claro! Já estou chamando alguém da equipe pra assumir aqui. 🙋',
    assunto_sensivel: 'Poxa, sinto muito por isso. Esse caso precisa de uma pessoa da equipe mesmo — já estou passando a conversa, com prioridade.',
    agente_travado: 'Acho que eu não estou conseguindo te ajudar direito, e você não merece ficar preso comigo. Vou chamar alguém da equipe. 🙏',
    seguranca: 'Entendi — alergia é coisa séria e eu não vou arriscar um chute. Já estou passando pra alguém da cozinha confirmar cada ingrediente com você. Enquanto isso, seguro seu pedido aqui sem mudar nada.',
  }[motivo] ?? 'Vou chamar um atendente pra te ajudar.';

  const prazo = dentroDoHorario
    ? 'Em instantes alguém assume esta conversa.'
    : 'Estamos fechados agora — assim que abrirmos, alguém te responde por aqui. Sua mensagem já está registrada como prioridade.';

  return `${base}\n\n${prazo}`;
}
