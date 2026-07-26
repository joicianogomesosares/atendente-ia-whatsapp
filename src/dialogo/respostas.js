// Banco de respostas com variação.
//
// A auditoria flagrou a mesma frase de fallback repetida 6 vezes, byte a byte,
// na mesma conversa — depois da segunda, qualquer cliente sabe que é máquina.
// Aqui cada situação tem várias formas de dizer, e o seletor NUNCA repete a
// última usada na mesma sessão. Placeholders {assim} são preenchidos na hora.

import { ESTABELECIMENTO, CARDAPIO } from '../cardapio.js';

const e = ESTABELECIMENTO;

export const BANCO = {
  saudacao: [
    `Oi! Aqui é a Sofia, do ${e.nome} 🍕 Já sabe o que vai pedir ou quer dar uma olhada no cardápio?`,
    `Olá! Sofia aqui, do ${e.nome}. Me diz: cardápio ou já veio decidido? 😄`,
    `Oi, tudo bem? Aqui é do ${e.nome}. Pode pedir direto ou me pedir o cardápio!`,
  ],
  saudacao_repetida: [
    'Oi de novo! 😄 Pode falar.',
    'Opa, to aqui! Me diz.',
    'Fala! O que mais?',
  ],
  despedida: [
    'Até logo! Qualquer coisa é só chamar. 🍕',
    'Valeu! Aparece sempre. 🙂',
    'Tchau tchau! Até a próxima.',
  ],
  agradecimento: [
    'Imagina, disponha! 😊',
    'Por nada! Precisando, é só chamar.',
    'Nós que agradecemos! 🙌',
  ],
  itens_adicionados: [
    'Anotado:\n{lista}',
    'Fechou! Ficou assim:\n{lista}',
    'Pode deixar:\n{lista}',
    'Tá na lista:\n{lista}',
  ],
  itens_removidos: [
    'Tirei {lista} do pedido. 👍',
    'Pronto, {lista} fora.',
    'Feito — removi {lista}.',
  ],
  quantidade_ajustada: [
    'Corrigido: {lista}.',
    'Ajustei — ficou {lista}.',
    'Pronto: {lista}.',
  ],
  pedido_limpo: [
    'Feito, zerei tudo. Vamos do começo: o que vai ser? 🙂',
    'Pronto, pedido limpo. Me diz o que você quer agora.',
    'Apaguei tudo. Recomeçando: o que te apetece hoje?',
  ],
  pergunta_mais_algo: [
    'Mais alguma coisa?',
    'Algo mais?',
    'Quer aproveitar e pedir mais alguma coisa?',
    'Só isso ou vai mais algo?',
  ],
  upsell_bebida: [
    'Uma bebida pra acompanhar? Temos refri, suco natural e vinho em taça. 🥤',
    'Vai uma bebida junto? Refri gelado, suco ou uma taça de vinho?',
  ],
  confirmar_qtd_grande: [
    '{qtd}x {item}, é isso mesmo? 😳 Confirma pra eu lançar.',
    'Só confirmando: {qtd} unidades de {item}? Se sim, eu anoto!',
  ],
  ambiguidade_pizza: [
    'Temos {opcoes}. Qual delas você quer?',
    'De pizza temos {opcoes} — qual vai ser?',
  ],
  total: [
    '{resumo_curto}',
    'Até agora: {resumo_curto}',
  ],
  total_vazio: [
    'Seu pedido ainda está vazio! Quer que eu te mostre o cardápio?',
    'Ainda não anotei nada. Me diz o que você quer que eu já monto. 🙂',
  ],
  pergunta_entrega_ou_retirada: [
    'Vai querer entrega ou retirada?',
    'É pra entregar ou você retira aqui?',
  ],
  entrega_escolhida: [
    `Combinado, entrega! Taxa de R$ ${e.entrega.taxa.toFixed(2)}, chega em ${e.entrega.tempoMedio}.\nMe passa o endereço completo, por favor.`,
    `Fechou, vai de entrega — R$ ${e.entrega.taxa.toFixed(2)} de taxa, ${e.entrega.tempoMedio}.\nQual o endereço?`,
  ],
  retirada_escolhida: [
    `Fechado, retirada no balcão! Fica pronto em ${e.retirada.tempoMedio}.`,
    `Beleza, você retira aqui — em ${e.retirada.tempoMedio} está pronto.`,
  ],
  endereco_anotado: [
    'Anotei: {endereco}\nConfere? Qualquer coisa me corrige.',
    'Endereço registrado: {endereco} ✔️',
  ],
  pagamento_anotado: [
    'Anotado: {forma}. 👍',
    'Fechou, {forma} então.',
    '{forma}, registrado! ✔️',
  ],
  pedido_fechado: [
    '{resumo}\n\nPedido {numero} confirmado! ✅ Obrigada!',
    '{resumo}\n\nFechado, pedido {numero}! Já foi pra cozinha. ✅',
  ],
  falta_para_fechar: [
    'Quase lá! Só falta: {faltando}.',
    'Pra fechar, me diz: {faltando}.',
  ],
  nao_sei: [
    'Boa pergunta! Essa eu não tenho aqui — deixa eu confirmar com o pessoal do salão e já te falo. Enquanto isso, posso ajudar com o pedido?',
    'Essa informação eu preciso confirmar com o gerente, não quero te falar errado. Te respondo já! Posso adiantar algo do cardápio?',
    'Hmm, essa eu não sei de cabeça — vou verificar aqui e te retorno. Quer aproveitar e ver o cardápio?',
  ],
  fallback: [
    'Não sei se entendi direito 😅 Me explica de outro jeito?',
    'Acho que me perdi aqui — pode repetir de outra forma?',
    'Desculpa, essa passou batida. Me conta de novo o que você precisa?',
  ],
  robo: [
    'Aqui é a Sofia, do atendimento! 🙂 Me diz o que você precisa que eu resolvo rapidinho.',
    'Sou a Sofia, cuido do WhatsApp da Cantina! Pode falar comigo. O que precisa?',
  ],
  cardapio: [
    `Nosso cardápio:\n\n{cardapio}\n\nO que vai ser?`,
    `Olha aí:\n\n{cardapio}\n\nMe diz o que te apetece! 😋`,
  ],
  observacao_anotada: [
    'Anotei a observação: {obs}. A cozinha faz sem problema. 👍',
    'Deixo registrado: {obs}. Pode ficar tranquilo.',
  ],
  recomendacao: [
    'A mais pedida é a Calabresa, mas a Quatro Queijos tem fã-clube 😄 Quer uma das duas?',
    'Eu sou suspeita, mas a Margherita com a búfala é covardia. A Calabresa também sai demais!',
  ],
};

// FAQs — respostas fixas por intenção. Uma variação só, porque informação
// factual repetida igual não denuncia robô; frase social repetida, sim.
export const FAQS = {
  faq_horario: `Funcionamos ${e.horario}. 🙂`,
  faq_endereco: 'Ficamos na Rua Aurora, 340 — Centro. Tem estacionamento na porta!',
  faq_taxa_entrega: `A taxa de entrega é R$ ${e.entrega.taxa.toFixed(2)}, num raio de ${e.entrega.raioKm}km. Me passa seu bairro que eu confirmo se alcançamos!`,
  faq_tempo: `Entrega leva de ${e.entrega.tempoMedio}. Retirada fica pronta em ${e.retirada.tempoMedio}.`,
  faq_pagamento_info: `Aceitamos ${e.pagamento.join(', ')}. Não parcelamos, e vale-refeição por enquanto não conseguimos aceitar.`,
  faq_vegetariano: (() => {
    const semAcento = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const opcoes = CARDAPIO
      .filter((i) => /margherita|quatro queijos|bruschetta|pao de alho/.test(semAcento(i.nome)))
      .map((i) => i.nome).join(', ');
    return `Temos opções vegetarianas: ${opcoes}. Para restrição séria (vegano, alergia), eu confirmo com a cozinha antes, tá?`;
  })(),
  faq_tamanho: 'Nossas pizzas são grandes, 8 fatias — servem bem 2 a 3 pessoas.',
  faq_promocao: 'Hoje não temos promoção ativa, mas na retirada você economiza os R$ 7,00 da entrega. 😉',
  faq_meia: 'Fazemos meia a meia sim! 🍕 O valor é o da pizza mais cara das duas. Quais dois sabores?',
  faq_reserva: 'Trabalhamos por ordem de chegada, sem reserva. Em dia de semana costuma ter mesa livre. Pra grupo grande, chega um pouquinho antes que a gente ajeita!',
  faq_nota: 'Emitimos nota fiscal sim! Me passa o CPF ou CNPJ que eu registro no pedido.',
  faq_bebida: 'De bebida temos refrigerante em lata (R$ 7), suco natural 500ml (R$ 12) e vinho tinto em taça (R$ 26). Cerveja no momento não trabalhamos.',
  faq_infantil: 'O ambiente é tranquilo pra crianças e temos cadeirão! Porção menor a cozinha adapta, é só pedir.',
  faq_estacionamento: 'Temos estacionamento na porta, sem custo. 🚗',
  faq_pet: 'Pet é bem-vindo na área externa! Na parte interna infelizmente não pode.',
  faq_wifi: 'Temos wi-fi pros clientes sim! A senha fica no balcão, é só pedir quando chegar.',
};

// Última variação usada por sessão+chave: é o que impede a repetição.
const ultimaUsada = new Map();

/** Escolhe uma variação diferente da última usada nesta sessão. */
export function variar(sessaoId, chave, dados = {}) {
  const opcoes = BANCO[chave];
  if (!opcoes) return null;

  const chaveSessao = `${sessaoId}:${chave}`;
  const anterior = ultimaUsada.get(chaveSessao);

  let indice = 0;
  if (opcoes.length > 1) {
    indice = anterior === undefined ? 0 : (anterior + 1) % opcoes.length;
  }
  ultimaUsada.set(chaveSessao, indice);

  return opcoes[indice].replace(/\{(\w+)\}/g, (_, nome) =>
    dados[nome] !== undefined ? String(dados[nome]) : `{${nome}}`
  );
}

export function limparMemoriaDeVariacao(sessaoId) {
  for (const chave of ultimaUsada.keys()) {
    if (chave.startsWith(`${sessaoId}:`)) ultimaUsada.delete(chave);
  }
}
