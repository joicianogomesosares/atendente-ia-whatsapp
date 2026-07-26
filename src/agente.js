// O agente: interpreta a mensagem do cliente e decide o que fazer.
//
// Retorna sempre a mesma forma, venha a resposta do LLM ou do modo mock:
//   { resposta: string, acoes: Array<{tipo, ...}> }
//
// As AÇÕES são executadas pelo pedido.js, não aqui. O agente só sugere.

import Anthropic from '@anthropic-ai/sdk';
import { CARDAPIO, ESTABELECIMENTO, cardapioEmTexto, buscarItem } from './cardapio.js';
import { responderPergunta } from './perguntas.js';

const MODELO = 'claude-sonnet-5';
const temChave = Boolean(process.env.ANTHROPIC_API_KEY);
const cliente = temChave
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export const modoAtual = temChave ? 'ia' : 'mock';

function promptDoSistema() {
  return `Você é a Sofia, atendente do ${ESTABELECIMENTO.nome}, respondendo pelo WhatsApp.
Você NÃO é um robô e nunca diz que é. Você é uma pessoa de verdade atendendo: simpática,
ágil, com jeito de quem conhece o restaurante de cor e gosta do que faz.

HORÁRIO: ${ESTABELECIMENTO.horario}
ENTREGA: taxa R$ ${ESTABELECIMENTO.entrega.taxa.toFixed(2)}, ${ESTABELECIMENTO.entrega.tempoMedio}, raio de ${ESTABELECIMENTO.entrega.raioKm}km
RETIRADA: pronto em ${ESTABELECIMENTO.retirada.tempoMedio}
PAGAMENTO: ${ESTABELECIMENTO.pagamento.join(', ')}

CARDÁPIO:
${cardapioEmTexto()}

COMO SE COMPORTAR COMO GENTE (é isto que te faz parecer humana):
- Fale português brasileiro coloquial, do jeito que um atendente bom fala no WhatsApp:
  "opa", "beleza", "fechou", "pode deixar", "já anotei aqui", "boa escolha!".
- VARIE. Nunca repita a mesma frase-robô. Se já confirmou um item com "anotado",
  na próxima use "fechou", "pode deixar", "tá na lista". Repetição entrega o robô.
- Mensagens CURTAS, é conversa. Uma a três linhas. Ninguém lê parágrafo no WhatsApp.
- Reaja ao que a pessoa diz, não só à tarefa. "Nossa, ótima escolha, essa é a mais
  pedida 😋". Se o cliente parecer com pressa, seja objetiva; se estiver de boa, seja calorosa.
- Puxe a conversa com naturalidade: se ele pediu pizza, pergunte se vai querer uma bebida
  pra acompanhar — como um bom atendente faz pra vender mais, sem forçar.
- Tenha memória do papo: se ele já disse o nome ou já escolheu retirada, não pergunte de novo.
- Empatia de verdade: "poxa, que chato isso", "imagina, sem problema nenhum",
  "relaxa que a gente resolve". Erro do cliente nunca é motivo pra secar ele.
- Emoji com moderação e naturalidade: no máximo um por mensagem, só quando cabe.
- Se não entender, pergunte como um humano perguntaria, sem "não compreendi sua solicitação".

REGRAS DE VERDADE (essas são inquebráveis):
- Nunca invente item, preço ou promoção que não esteja no cardápio acima.
- NUNCA calcule o total você mesmo. O sistema calcula e mostra o resumo.
- Se o cliente pedir algo que não existe, diga o que tem de parecido, sem inventar.

FORMATO DA RESPOSTA — responda SEMPRE com um único objeto JSON, sem markdown:
{
  "resposta": "o texto que o cliente vai ler",
  "acoes": [
    {"tipo": "adicionar", "item": "<nome exato do cardápio>", "quantidade": 1},
    {"tipo": "remover", "item": "<nome exato do cardápio>"},
    {"tipo": "modalidade", "valor": "entrega" | "retirada", "endereco": "<se entrega>"},
    {"tipo": "pagamento", "valor": "Pix" | "Cartão na entrega" | "Dinheiro"},
    {"tipo": "mostrar_resumo"},
    {"tipo": "finalizar"}
  ]
}
O campo "acoes" pode ser uma lista vazia. Só inclua uma ação quando o cliente
tiver deixado claro o que quer.`;
}

function extrairJson(texto) {
  const limpo = texto.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (inicio !== -1 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1));
      } catch { /* cai no fallback abaixo */ }
    }
    // O modelo respondeu em texto puro. Melhor entregar isso ao cliente do
    // que quebrar a conversa com erro técnico.
    return { resposta: limpo, acoes: [] };
  }
}

async function responderComIA(historico) {
  const mensagens = historico.map((m) => ({
    role: m.autor === 'cliente' ? 'user' : 'assistant',
    content: m.texto,
  }));

  const resultado = await cliente.messages.create({
    model: MODELO,
    max_tokens: 700,
    system: promptDoSistema(),
    messages: mensagens,
  });

  const texto = resultado.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return extrairJson(texto);
}

// ---------------------------------------------------------------------------
// MODO MOCK — sem chave de API.
//
// Não é enfeite: é o que garante que a demonstração roda na frente do cliente
// sem internet, sem cota e sem custo. Cobre o caminho feliz de um pedido.
// ---------------------------------------------------------------------------

function normalizar(t) {
  return (t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Distância de edição (Levenshtein). Usada só para tolerar erro de digitação. */
function distancia(a, b) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = linha[j];
      linha[j] = Math.min(
        linha[j] + 1,                                   // remoção
        linha[j - 1] + 1,                               // inserção
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1)      // substituição
      );
      anterior = temp;
    }
  }
  return linha[b.length];
}

/**
 * A palavra aparece no texto, mesmo digitada errado?
 * Cliente escreve "calabreza", "margerita", "tiramissu" — e ainda assim
 * espera ser entendido. Tolerância proporcional ao tamanho da palavra:
 * palavra curta com 2 erros vira outra palavra.
 */
function pareceCom(palavra, texto) {
  if (texto.includes(palavra)) return true;

  const tolerancia = palavra.length > 7 ? 2 : palavra.length > 4 ? 1 : 0;
  if (tolerancia === 0) return false;

  return texto
    .split(/\s+/)
    .some((t) => Math.abs(t.length - palavra.length) <= tolerancia
              && distancia(t, palavra) <= tolerancia);
}

function responderMock(historico, contexto = {}) {
  const textoOriginal = historico.at(-1)?.texto ?? '';
  const ultima = normalizar(textoOriginal);
  const acoes = [];

  if (/(^|\W)(oi|ola|bom dia|boa tarde|boa noite|eai|e ai)(\W|$)/.test(ultima)) {
    return {
      resposta: `Oi! Aqui é o atendimento do ${ESTABELECIMENTO.nome} 🍕\nQuer ver o cardápio ou já sabe o que vai pedir?`,
      acoes: [],
    };
  }

  // Fechamento vem ANTES de horário: "fechar" contém "fecha" e colidia.
  if (/\b(fechar|finalizar|so isso|e isso|confirmar|pode mandar)\b/.test(ultima)) {
    return { resposta: 'Perfeito, vou fechar seu pedido!', acoes: [{ tipo: 'finalizar' }] };
  }

  if (/\b(cardapio|menu|opcoes|o que tem|tem o que)\b/.test(ultima)) {
    return { resposta: `Nosso cardápio:\n\n${cardapioEmTexto()}\n\nO que vai ser?`, acoes: [] };
  }

  // O \b aqui não é preciosismo: sem ele "abre" casa dentro de
  // "calABREsa", e quem pede calabresa recebe o horário de funcionamento.
  if (/\b(horario|que horas|aberto|abertos|fecha|fecham|abre|abrem)\b/.test(ultima)) {
    return { resposta: `Funcionamos ${ESTABELECIMENTO.horario}. Quer pedir?`, acoes: [] };
  }

  // Perguntar sobre entrega ≠ escolher entrega.
  // "Quanto é a taxa?" é informação. "É para entrega" é decisão, e precisa
  // gravar a modalidade — senão o pedido nunca reúne o necessário para fechar.
  const e = ESTABELECIMENTO.entrega;

  if (/\b(taxa|frete|quanto|demora|entregam|entregando)\b/.test(ultima)) {
    return {
      resposta: `Entregamos num raio de ${e.raioKm}km. Taxa de R$ ${e.taxa.toFixed(2)} e leva de ${e.tempoMedio}.\nPrefere entrega ou retirada?`,
      acoes: [],
    };
  }

  if (/\b(entrega|entregar|delivery)\b/.test(ultima)) {
    return {
      resposta: `Combinado, entrega! Taxa de R$ ${e.taxa.toFixed(2)}, chega em ${e.tempoMedio}.\nMe passa o endereço completo, por favor.`,
      acoes: [{ tipo: 'modalidade', valor: 'entrega' }],
    };
  }

  if (/\b(retirada|retirar|buscar|balcao)\b/.test(ultima)) {
    return {
      resposta: `Fechado! Retirada no balcão, pronto em ${ESTABELECIMENTO.retirada.tempoMedio}.\nO que vai querer?`,
      acoes: [{ tipo: 'modalidade', valor: 'retirada' }],
    };
  }

  if (/\b(pix|cartao|dinheiro)\b/.test(ultima)) {
    const forma = /\bpix\b/.test(ultima)
      ? 'Pix'
      : /\bcartao\b/.test(ultima) ? 'Cartão na entrega' : 'Dinheiro';
    return {
      resposta: `Anotado: ${forma}. 👍`,
      acoes: [{ tipo: 'pagamento', valor: forma }, { tipo: 'mostrar_resumo' }],
    };
  }

  // Casamento de item por PONTUAÇÃO, não pelo primeiro que bater.
  // "pizza calabresa" casa 1 palavra na Margherita e 2 na Calabresa.
  // Sem pontuar, o cliente recebia a pizza errada.
  // Ninguém pede um item por mensagem. "2 calabresa E um tiramisu" é UMA
  // mensagem com DOIS itens — sem quebrar por conector, o segundo some do
  // pedido e o cliente só descobre na hora da entrega.
  const trechos = ultima
    .split(/\s+e\s+|\s+mais\s+|,|\+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const encontrados = [];
  let ambiguidade = null;

  for (const trecho of trechos) {
    const candidatos = CARDAPIO
      .map((item) => {
        const palavras = normalizar(item.nome).split(' ').filter((p) => p.length > 3);
        return { item, pontos: palavras.filter((p) => pareceCom(p, trecho)).length };
      })
      .filter((c) => c.pontos > 0);

    if (candidatos.length === 0) continue;

    const melhorPontuacao = Math.max(...candidatos.map((c) => c.pontos));
    const empatados = candidatos.filter((c) => c.pontos === melhorPontuacao);

    // Empate = pedido ambíguo ("quero uma pizza"). Perguntar é melhor que
    // chutar — item errado no pedido vira reclamação na hora da entrega.
    if (empatados.length > 1) {
      ambiguidade ??= empatados.map((c) => c.item.nome).join(', ');
      continue;
    }

    const m = trecho.match(/(\d+)\s*x?/);
    encontrados.push({ item: empatados[0].item, quantidade: m ? Number(m[1]) : 1 });
  }

  if (encontrados.length > 0) {
    for (const { item, quantidade } of encontrados) {
      acoes.push({ tipo: 'adicionar', item: item.nome, quantidade });
    }

    const lista = encontrados.map((x) => `${x.quantidade}x ${x.item.nome}`).join('\n');
    const pendente = ambiguidade
      ? `\n\nSobre o outro: temos ${ambiguidade}. Qual você quer?`
      : '';

    return { resposta: `Anotado:\n${lista}${pendente}\n\nMais alguma coisa?`, acoes };
  }

  if (ambiguidade) {
    return { resposta: `Temos: ${ambiguidade}.\nQual delas você quer?`, acoes: [] };
  }

  // Perguntas frequentes vêm DEPOIS do cardápio de propósito:
  // "quero um vinho" deve virar item no pedido, não resposta sobre bebidas.
  const respostaFaq = responderPergunta(ultima);
  if (respostaFaq) return { resposta: respostaFaq, acoes: [] };

  // Endereço: só interpretamos como endereço quando já escolhemos entrega e
  // ainda não temos um. Fora desse estado, um texto solto não é endereço.
  const pedido = contexto.pedido;
  if (pedido?.modalidade === 'entrega' && !pedido.endereco && textoOriginal.trim().length >= 8) {
    return {
      resposta: `Anotei o endereço: ${textoOriginal.trim()}\nEstá certo? Se sim, é só confirmar que eu fecho o pedido.`,
      acoes: [{ tipo: 'modalidade', valor: 'entrega', endereco: textoOriginal.trim() }],
    };
  }

  return {
    resposta: 'Desculpa, não entendi 😅 Quer ver o cardápio? É só digitar "cardápio".',
    acoes: [],
    naoEntendeu: true,
  };
}

export async function responder(historico, contexto = {}) {
  if (!temChave) return responderMock(historico, contexto);
  try {
    return await responderComIA(historico);
  } catch (erro) {
    // Falha de API não pode derrubar o atendimento. Cai para o mock e registra.
    console.error('[agente] IA falhou, usando modo mock:', erro.message);
    return responderMock(historico, contexto);
  }
}

export { buscarItem };
