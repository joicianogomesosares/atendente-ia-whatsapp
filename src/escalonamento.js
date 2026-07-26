// Escalonamento para atendente humano.
//
// Este é o módulo que separa um chatbot que o cliente ama de um que ele odeia.
// Todo mundo já ficou preso num robô que não entende e não passa para ninguém.
// A regra aqui define exatamente quando o robô admite que não dá conta.

/** Palavras que sinalizam pedido explícito de humano. */
export const PEDIDOS_DE_HUMANO = [
  'atendente', 'humano', 'pessoa', 'gerente', 'responsavel', 'responsável',
  'falar com alguem', 'falar com alguém', 'nao e robo', 'não é robô',
];

/** Assuntos que o robô não tem autoridade para resolver sozinho. */
export const ASSUNTOS_SENSIVEIS = [
  'reclamacao', 'reclamação', 'reembolso', 'estorno', 'cancelar pedido',
  'veio errado', 'veio frio', 'passou mal', 'alergia', 'intoxicacao',
  'intoxicação', 'processo', 'procon', 'advogado',
];

export function normalizar(texto) {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function contemAlgum(texto, lista) {
  const t = normalizar(texto);
  return lista.some((termo) => t.includes(normalizar(termo)));
}

/**
 * Decide se a conversa deve sair do robô e ir para um humano.
 *
 * @param {object} contexto
 * @param {string} contexto.mensagem        - a última mensagem do cliente
 * @param {number} contexto.tentativasSemEntender - quantas vezes seguidas o
 *                                            agente não entendeu o cliente
 * @param {number} contexto.totalMensagens  - tamanho da conversa até agora
 * @param {boolean} contexto.dentroDoHorario - se o restaurante está aberto
 * @param {object} contexto.pedido          - estado atual do pedido
 *
 * @returns {{escalar: boolean, motivo: string|null, mensagem: string|null}}
 */
export function avaliarEscalonamento(contexto) {
  // ┌───────────────────────────────────────────────────────────────────┐
  // │ TODO — SUA DECISÃO DE NEGÓCIO                                     │
  // │                                                                   │
  // │ Implemente aqui a regra de escalonamento. São ~8 linhas.          │
  // │                                                                   │
  // │ Os casos óbvios (já tem os helpers prontos acima):                │
  // │   • cliente pediu humano explicitamente → PEDIDOS_DE_HUMANO       │
  // │   • assunto sensível → ASSUNTOS_SENSIVEIS                         │
  // │   • agente travou → contexto.tentativasSemEntender                │
  // │                                                                   │
  // │ O TRADE-OFF REAL, e é você quem decide:                           │
  // │                                                                   │
  // │ Escalar cedo demais → o dono do restaurante recebe notificação a  │
  // │ toda hora, se irrita, e cancela a mensalidade no segundo mês.     │
  // │ Você perde a recorrência, que é onde está seu dinheiro.           │
  // │                                                                   │
  // │ Escalar tarde demais → cliente furioso preso no robô às 22h.      │
  // │ Uma avaliação ruim no Google e o dono culpa a sua automação.      │
  // │                                                                   │
  // │ E FORA DO HORÁRIO? Não existe humano para receber. Você:          │
  // │   (a) escala mesmo assim e avisa que respondem amanhã             │
  // │   (b) não escala e tenta resolver, deixando recado na fila        │
  // │ A (a) é honesta. A (b) segura mais pedido. Sua chamada.           │
  // │                                                                   │
  // │ Sugestão de limiar para começar: 3 tentativas sem entender.       │
  // └───────────────────────────────────────────────────────────────────┘

  return { escalar: false, motivo: null, mensagem: null };
}

/** Texto padrão mostrado ao cliente quando a conversa é escalada. */
export function mensagemDeEscalonamento(motivo, dentroDoHorario) {
  const base = {
    pedido_explicito: 'Claro! Já estou chamando um atendente.',
    assunto_sensivel: 'Entendi, e isso precisa de um atendente de verdade. Já estou passando.',
    agente_travado: 'Desculpa, acho que não estou te ajudando direito. Vou chamar alguém da equipe.',
  }[motivo] ?? 'Vou chamar um atendente para te ajudar.';

  const prazo = dentroDoHorario
    ? 'Em instantes alguém assume aqui na conversa.'
    : 'Estamos fechados agora — assim que abrirmos, alguém te responde por aqui.';

  return `${base}\n\n${prazo}`;
}
