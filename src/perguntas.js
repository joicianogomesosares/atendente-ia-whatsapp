// Perguntas frequentes — a tabela que você ajusta para cada cliente.
//
// ESTE é o arquivo que fecha contrato. Na demonstração, o dono do restaurante
// vai digitar a pergunta que ele mais recebe. Se o bot travar, você perdeu a
// venda. Cada linha aqui é uma pergunta que ele NÃO vai mais responder à mão.
//
// Para um cliente novo: leia o histórico real do WhatsApp dele por 15 minutos,
// anote as 20 perguntas mais repetidas e traduza para esta tabela.

import { ESTABELECIMENTO, CARDAPIO } from './cardapio.js';

const e = ESTABELECIMENTO;

/**
 * Cada entrada tem:
 *   termos   — palavras/expressões que disparam a resposta (sem acento, minúsculas)
 *   resposta — texto ou função que devolve o texto
 */
export const PERGUNTAS_FREQUENTES = [
  {
    nome: 'meia_a_meia',
    termos: ['meia a meia', 'meio a meio', 'metade', 'dois sabores', '2 sabores'],
    resposta: 'Fazemos sim, meia a meia! 🍕 O valor é o da pizza mais cara das duas. Quais dois sabores você quer?',
  },
  {
    nome: 'endereco_restaurante',
    termos: ['onde fica', 'endereco de voces', 'qual o endereco', 'localizacao', 'como chegar'],
    resposta: `Ficamos na Rua Aurora, 340 — Centro. Tem estacionamento na porta.\nAberto ${e.horario}.`,
  },
  {
    nome: 'vegetariano',
    termos: ['vegetariano', 'vegetariana', 'vegano', 'sem carne', 'sem lactose'],
    resposta: () => {
      // Compara sem acento: "Pão de Alho" não casa com /pao de alho/.
      const semAcento = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const opcoes = CARDAPIO
        .filter((i) => /margherita|quatro queijos|bruschetta|pao de alho/.test(semAcento(i.nome)))
        .map((i) => i.nome)
        .join(', ');
      return `Temos opções vegetarianas: ${opcoes}.\nPara vegano ou sem lactose, me avisa que confirmo com a cozinha antes.`;
    },
  },
  {
    nome: 'sem_ingrediente',
    termos: ['sem cebola', 'sem azeitona', 'sem alho', 'sem queijo', 'tirar a', 'nao gosto de'],
    resposta: 'Sem problema, a cozinha faz a alteração. Vou anotar na observação do pedido. 👍',
  },
  {
    nome: 'tamanho',
    termos: ['tamanho', 'quantos pedacos', 'quantas fatias', 'quantas pessoas', 'da para quantas'],
    resposta: 'Nossas pizzas são grandes, 8 fatias — servem bem 2 a 3 pessoas.',
  },
  {
    nome: 'promocao',
    termos: ['promocao', 'desconto', 'cupom', 'combo', 'mais barato'],
    resposta: 'Hoje não temos promoção ativa, mas na retirada você economiza a taxa de entrega de R$ 7,00. 😉',
  },
  {
    nome: 'tempo_espera',
    termos: ['quanto tempo', 'demora quanto', 'fica pronto', 'chega quando', 'ta demorando'],
    resposta: `Entrega leva de ${e.entrega.tempoMedio}. Na retirada fica pronto em ${e.retirada.tempoMedio}.`,
  },
  {
    nome: 'formas_pagamento',
    termos: ['como posso pagar', 'formas de pagamento', 'aceita cartao', 'aceitam pix', 'pode parcelar'],
    resposta: `Aceitamos ${e.pagamento.join(', ')}. Não parcelamos.`,
  },
  {
    nome: 'raio_entrega',
    termos: ['entregam no bairro', 'entrega ate', 'chega no meu', 'atendem a regiao', 'entregam onde'],
    resposta: `Entregamos num raio de ${e.entrega.raioKm}km do restaurante. Me passa seu bairro que eu confirmo.`,
  },
  {
    nome: 'reserva',
    termos: ['reservar mesa', 'reserva', 'mesa para', 'tem mesa'],
    resposta: 'Trabalhamos por ordem de chegada, sem reserva. Nos dias de semana costuma ter mesa livre. 🙂',
  },
  {
    nome: 'nota_fiscal',
    termos: ['nota fiscal', 'cupom fiscal', 'cnpj na nota', 'preciso de nota'],
    resposta: 'Emitimos nota fiscal sim. Me passa o CPF ou CNPJ e eu registro no pedido.',
  },
  {
    nome: 'bebida_alcoolica',
    termos: ['cerveja', 'chopp', 'vinho', 'bebida alcoolica', 'drink'],
    resposta: 'Temos vinho tinto em taça (R$ 26,00). Cerveja no momento não trabalhamos.',
  },
  {
    nome: 'infantil',
    termos: ['criancas', 'crianca', 'cadeirao', 'menu infantil'],
    resposta: 'O ambiente é bem tranquilo para crianças e temos cadeirão. Porção pequena a gente adapta, é só pedir.',
  },
  {
    nome: 'agradecimento',
    termos: ['obrigado', 'obrigada', 'valeu', 'brigado', 'agradecido'],
    resposta: 'Imagina, disponha! 😊 Qualquer coisa é só chamar.',
  },
  {
    nome: 'despedida',
    termos: ['tchau', 'ate mais', 'falou', 'ate logo', 'boa noite pra voce'],
    resposta: 'Até logo! Seu pedido já está com a cozinha. 🍕',
  },
];

/** Casa a mensagem contra a tabela. Retorna o texto ou null. */
export function responderPergunta(mensagemNormalizada) {
  for (const item of PERGUNTAS_FREQUENTES) {
    if (item.termos.some((t) => mensagemNormalizada.includes(t))) {
      return typeof item.resposta === 'function' ? item.resposta() : item.resposta;
    }
  }
  return null;
}
