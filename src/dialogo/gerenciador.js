// Gerenciador de diálogo: o maestro.
//
// Recebe a mensagem já garantida como "não escalável" pelo servidor, e decide:
// que operações aplicar no pedido, que perguntas responder, e como compor UMA
// resposta que reaja a TUDO que o cliente disse — saudação junto com pergunta
// não pode engolir a pergunta (era o bug nº 6 da auditoria).

import { classificar } from '../nlu/classificador.js';
import { preparar } from '../nlu/normalizador.js';
import {
  extrairOperacoes, extrairEndereco, extrairPagamento, nomeDoItem, precoDoItem,
} from '../nlu/extrator.js';
import { variar, FAQS } from './respostas.js';
import { cardapioEmTexto } from '../cardapio.js';

// Memória de sessão do diálogo (separada do pedido, que é estado de negócio).
const sessoes = new Map();

export function memoriaDe(sessaoId) {
  if (!sessoes.has(sessaoId)) {
    sessoes.set(sessaoId, {
      jaCumprimentou: false,
      upsellFeito: false,
      pendencia: null, // {tipo: 'confirmar_qtd'|'escolher_pizza'|..., dados}
      fallbacksSeguidos: 0,
    });
  }
  return sessoes.get(sessaoId);
}

export function limparMemoria(sessaoId) {
  sessoes.delete(sessaoId);
}

const LIMITE_QTD_SEM_CONFIRMAR = 4;

/** Saudação no começo da mensagem? Devolve [saudacaoDetectada, resto]. */
function separarSaudacao(textoPrep) {
  const m = textoPrep.match(/^(oi|ola|opa|eai|e ai|bom dia|boa tarde|boa noite)[,!. ]*(.*)$/);
  if (!m) return [null, textoPrep];
  return [m[1], m[2].trim()];
}

const INTENCOES_DE_ESTADO = new Set([
  'pedir_item', 'remover_item', 'alterar_quantidade', 'limpar_pedido',
  'escolher_entrega', 'escolher_retirada', 'escolher_pagamento', 'finalizar',
  'perguntar_total', 'ver_resumo', 'confirmar', 'negar',
]);

/**
 * Processa a mensagem e devolve { resposta, acoes, naoEntendeu }.
 * As ações seguem o contrato antigo do servidor (adicionar/remover/...).
 */
export function conduzir({ sessaoId, texto, modelo, pedido }) {
  const memoria = memoriaDe(sessaoId);
  const acoes = [];
  const partes = []; // pedaços da resposta final
  const textoPrep = preparar(texto);
  const idsNoCarrinho = pedido.itens.map((i) => i.id);

  // ---- 0. Pendência aberta (pergunta que NÓS fizemos e o cliente respondeu)
  if (memoria.pendencia) {
    const resolvida = resolverPendencia({ memoria, textoPrep, texto, acoes, partes, sessaoId });
    if (resolvida) {
      memoria.fallbacksSeguidos = 0;
      return montarSaida(partes, acoes, false);
    }
    // Não resolvida: o cliente mudou de assunto. Esquece a pendência e segue.
    memoria.pendencia = null;
  }

  // ---- 1. Saudação (responde, mas NUNCA engole o resto da mensagem)
  const [saudacao, resto] = separarSaudacao(textoPrep);
  if (saudacao) {
    partes.push(variar(sessaoId, memoria.jaCumprimentou ? 'saudacao_repetida' : 'saudacao'));
    memoria.jaCumprimentou = true;
    if (!resto) return montarSaida(partes, acoes, false);
  }
  const corpo = saudacao ? resto : textoPrep;

  // ---- 2. Operações de carrinho (verbo antes do produto)
  const { operacoes, observacoes, ambiguidades, consultaItens = [] } =
    extrairOperacoes(corpo, { itensNoCarrinho: idsNoCarrinho });

  // Consulta de preço de item específico ("quanto custa o tiramisù?"): responde
  // o preço direto, antes de qualquer classificação de intenção. Sem isto, caía
  // no FAQ de taxa de entrega porque "quanto custa" batia lá.
  if (consultaItens.length && /\b(quanto|qto|preco|custa|caro|barato|vale|sai por)\b/.test(corpo)) {
    const precos = consultaItens
      .map((id) => precoDoItem(id))
      .filter(Boolean)
      .map((p) => `${p.nome} sai ${p.texto}`);
    if (precos.length) {
      partes.push(precos.join('. ') + '. Quer que eu já anote?');
      return montarSaida(partes, acoes, false);
    }
  }

  const adicionados = [];
  const removidos = [];
  const ajustados = [];

  for (const op of operacoes) {
    if (op.tipo === 'limpar') {
      acoes.push({ tipo: 'limpar' });
      partes.length = 0;
      partes.push(variar(sessaoId, 'pedido_limpo'));
      memoria.fallbacksSeguidos = 0;
      return montarSaida(partes, acoes, false);
    }
    if (op.tipo === 'adicionar') {
      if (op.quantidade > LIMITE_QTD_SEM_CONFIRMAR) {
        // Trava de plausibilidade: 15 pizzas não entram sem confirmação.
        memoria.pendencia = { tipo: 'confirmar_qtd', dados: op };
        partes.push(variar(sessaoId, 'confirmar_qtd_grande', {
          qtd: op.quantidade, item: nomeDoItem(op.id),
        }));
        continue;
      }
      acoes.push({ tipo: 'adicionar', item: nomeDoItem(op.id), quantidade: op.quantidade });
      adicionados.push(`${op.quantidade}x ${nomeDoItem(op.id)}`);
    }
    if (op.tipo === 'remover') {
      acoes.push({ tipo: 'remover', item: nomeDoItem(op.id), quantidade: op.quantidade ?? null });
      removidos.push(
        Number.isFinite(op.quantidade) ? `${op.quantidade}x ${nomeDoItem(op.id)}` : nomeDoItem(op.id)
      );
    }
    if (op.tipo === 'definir_qtd') {
      acoes.push({ tipo: 'definir_qtd', item: nomeDoItem(op.id), quantidade: op.quantidade });
      ajustados.push(`${op.quantidade}x ${nomeDoItem(op.id)}`);
    }
  }

  if (adicionados.length) partes.push(variar(sessaoId, 'itens_adicionados', { lista: adicionados.join('\n') }));
  if (removidos.length) partes.push(variar(sessaoId, 'itens_removidos', { lista: removidos.join(', ') }));
  if (ajustados.length) partes.push(variar(sessaoId, 'quantidade_ajustada', { lista: ajustados.join(', ') }));

  for (const obs of observacoes) {
    acoes.push({ tipo: 'observacao', texto: obs });
    partes.push(variar(sessaoId, 'observacao_anotada', { obs }));
  }

  if (ambiguidades.length) {
    const opcoes = ambiguidades[0].ambiguoEntre.map(nomeDoItem).join(', ');
    memoria.pendencia = { tipo: 'escolher_item', dados: ambiguidades[0] };
    partes.push(variar(sessaoId, 'ambiguidade_pizza', { opcoes }));
  }

  // ---- 2b. Comandos de ESTADO podem vir vários numa frase só.
  //          "retirada msm, pago no pix, fecha aí" traz modalidade + pagamento
  //          + finalizar de uma vez. O classificador só devolve UMA intenção,
  //          então detectamos os três por regex e aplicamos TODOS os presentes.
  const mexeuNoEstado = aplicarComandosDeEstado({ corpo, texto, sessaoId, pedido, acoes, partes });

  const mexeuNoCarrinho = operacoes.length > 0 || observacoes.length > 0 || ambiguidades.length > 0;

  // ---- 2c. Endereço pendente tem PRIORIDADE sobre a classificação de intenção.
  //          Se já é entrega e falta o endereço, um texto de endereço deve ser
  //          SALVO — mesmo que contenha uma palavra que também aparece na FAQ
  //          ("rua Aurora" bate na FAQ do endereço do restaurante). Sem esta
  //          precedência, "rua Aurora 200" respondia o endereço DA CANTINA em
  //          vez de anotar o endereço do cliente.
  if (pedido.modalidade === 'entrega' && !pedido.endereco && !mexeuNoCarrinho && !mexeuNoEstado) {
    const endereco = extrairEndereco(texto);
    if (endereco) {
      acoes.push({ tipo: 'modalidade', valor: 'entrega', endereco });
      partes.push(variar(sessaoId, 'endereco_anotado', { endereco }));
      memoria.fallbacksSeguidos = 0;
      return montarSaida(partes, acoes, false);
    }
  }

  // ---- 3. Intenção da parte "conversacional"
  let intencao = null;
  let confianca = 0;
  if (corpo) {
    const r = classificar(modelo, corpo);
    intencao = r.melhor;
    confianca = r.confianca;
  }

  // Mensagem que já virou operação de carrinho não precisa (nem deve) ser
  // reinterpretada como intenção — a não ser que a intenção seja de estado
  // e muito clara ("2 calabresas, pode fechar").
  const intencaoConfiavel = confianca >= 0.12
    || (intencao && !INTENCOES_DE_ESTADO.has(intencao) && confianca >= 0.06);

  // Comandos de estado já tratados por regex não devem ser retratados pela
  // intenção única (evita resposta dupla de modalidade/pagamento).
  const INTENCOES_JA_TRATADAS = new Set(['escolher_entrega', 'escolher_retirada', 'escolher_pagamento', 'finalizar']);
  const intencaoRedundante = mexeuNoEstado && INTENCOES_JA_TRATADAS.has(intencao);

  if (!intencaoRedundante
      && (!mexeuNoCarrinho || (intencaoConfiavel && !['pedir_item', 'remover_item'].includes(intencao)))) {
    tratarIntencao({ intencao, intencaoConfiavel, sessaoId, memoria, pedido, acoes, partes, texto, corpo });
  }

  // ---- 4. Continuidade natural depois de mexer no carrinho
  if (mexeuNoCarrinho && adicionados.length) {
    const temBebida = pedido.itens.some((i) => i.id.startsWith('beb'))
      || acoes.some((a) => a.tipo === 'adicionar' && /Refrigerante|Suco|Vinho/.test(a.item));
    if (!temBebida && !memoria.upsellFeito) {
      memoria.upsellFeito = true;
      partes.push(variar(sessaoId, 'upsell_bebida'));
    } else if (!memoria.pendencia) {
      partes.push(variar(sessaoId, 'pergunta_mais_algo'));
    }
  }

  // ---- 5. Nada entendido em lugar nenhum → fallback honesto e variado.
  //         Uma ação sem texto (ex.: mostrar_resumo) NÃO é fallback: o
  //         servidor vai anexar o resumo. Só cai aqui se não há resposta
  //         nenhuma nem ação nenhuma.
  if (partes.length === 0 && acoes.length === 0) {
    // Endereço pendente? Texto livre pode ser o endereço que pedimos.
    if (pedido.modalidade === 'entrega' && !pedido.endereco) {
      const endereco = extrairEndereco(texto);
      if (endereco) {
        acoes.push({ tipo: 'modalidade', valor: 'entrega', endereco });
        partes.push(variar(sessaoId, 'endereco_anotado', { endereco }));
        memoria.fallbacksSeguidos = 0;
        return montarSaida(partes, acoes, false);
      }
    }
    memoria.fallbacksSeguidos += 1;
    partes.push(variar(sessaoId, 'fallback'));
    return montarSaida(partes, acoes, true);
  }

  memoria.fallbacksSeguidos = 0;
  return montarSaida(partes, acoes, false);
}

/**
 * Detecta e aplica TODOS os comandos de estado presentes numa mensagem, de uma
 * vez: modalidade (entrega/retirada), pagamento (pix/cartão/dinheiro) e
 * finalizar. Retorna true se aplicou algum. É o que faz "retirada, pago no pix,
 * fecha aí" funcionar numa frase só, em vez de exigir três mensagens.
 */
function aplicarComandosDeEstado({ corpo, texto, sessaoId, pedido, acoes, partes }) {
  if (!corpo) return false;
  let aplicou = false;

  // Modalidade — só quando é DECISÃO ("é retirada"), não pergunta ("quanto é a
  // taxa de entrega?"). A presença de "?" ou "quanto/qual" indica pergunta.
  const ehPerguntaEntrega = /[?]/.test(texto) || /\b(quanto|qual|taxa|quanto custa)\b/.test(corpo);
  if (!pedido.modalidade) {
    if (/\b(retirada|retirar|buscar|balcao|vou buscar|vou pegar|pego ai|retiro)\b/.test(corpo)) {
      acoes.push({ tipo: 'modalidade', valor: 'retirada' });
      partes.push(variar(sessaoId, 'retirada_escolhida'));
      aplicou = true;
    } else if (!ehPerguntaEntrega && /\b(entrega|entregar|delivery|em casa|na minha casa|traz aqui|manda aqui)\b/.test(corpo)) {
      acoes.push({ tipo: 'modalidade', valor: 'entrega' });
      partes.push(variar(sessaoId, 'entrega_escolhida'));
      aplicou = true;
    }
  }

  // Pagamento
  if (!pedido.pagamento) {
    const forma = extrairPagamento(texto);
    if (forma && /\b(pago|pagar|paga|vou de|no|em|com|fica|prefiro)\b/.test(corpo)) {
      acoes.push({ tipo: 'pagamento', valor: forma });
      partes.push(variar(sessaoId, 'pagamento_anotado', { forma }));
      aplicou = true;
    }
  }

  // Finalizar
  if (/\b(fecha|fechar|finaliza|finalizar|pode fechar|pode mandar|manda ver|conclui|confirma o pedido|ta fechado|fechou)\b/.test(corpo)) {
    acoes.push({ tipo: 'finalizar' });
    aplicou = true;
  }

  return aplicou;
}

function tratarIntencao({ intencao, intencaoConfiavel, sessaoId, memoria, pedido, acoes, partes, texto, corpo }) {
  if (!intencao || !intencaoConfiavel) return;

  // FAQs: resposta direta da tabela.
  if (FAQS[intencao]) { partes.push(FAQS[intencao]); return; }

  switch (intencao) {
    case 'saudacao':
      if (partes.length === 0) {
        partes.push(variar(sessaoId, memoria.jaCumprimentou ? 'saudacao_repetida' : 'saudacao'));
        memoria.jaCumprimentou = true;
      }
      break;
    case 'despedida': partes.push(variar(sessaoId, 'despedida')); break;
    case 'agradecimento': partes.push(variar(sessaoId, 'agradecimento')); break;
    case 'pedir_cardapio':
      partes.push(/recomenda|indica|sugere|melhor|mais pedida|carro chefe/.test(corpo)
        ? variar(sessaoId, 'recomendacao')
        : variar(sessaoId, 'cardapio', { cardapio: cardapioEmTexto() }));
      break;
    case 'perguntar_total':
    case 'ver_resumo':
      if (pedido.itens.length === 0) partes.push(variar(sessaoId, 'total_vazio'));
      else acoes.push({ tipo: 'mostrar_resumo' });
      break;
    case 'escolher_entrega':
      acoes.push({ tipo: 'modalidade', valor: 'entrega' });
      partes.push(variar(sessaoId, 'entrega_escolhida'));
      break;
    case 'escolher_retirada':
      acoes.push({ tipo: 'modalidade', valor: 'retirada' });
      partes.push(variar(sessaoId, 'retirada_escolhida'));
      break;
    case 'escolher_pagamento': {
      const forma = extrairPagamento(texto);
      if (forma) {
        acoes.push({ tipo: 'pagamento', valor: forma });
        partes.push(variar(sessaoId, 'pagamento_anotado', { forma }));
        if (pedido.itens.length > 0) acoes.push({ tipo: 'mostrar_resumo' });
      }
      break;
    }
    case 'finalizar':
      acoes.push({ tipo: 'finalizar' });
      break;
    case 'pedir_humano':
      // Normalmente o servidor escala antes; "isso é robô?" cai aqui.
      partes.push(variar(sessaoId, 'robo'));
      break;
    case 'fora_escopo':
      partes.push(variar(sessaoId, 'nao_sei'));
      break;
    case 'observacao_ingrediente':
      // Extrator não achou ingrediente conhecido; ainda assim anota o recado.
      acoes.push({ tipo: 'observacao', texto: texto.trim() });
      partes.push(variar(sessaoId, 'observacao_anotada', { obs: texto.trim() }));
      break;
    case 'confirmar':
      if (pedido.itens.length > 0 && !pedido.finalizado) acoes.push({ tipo: 'finalizar' });
      break;
    case 'negar':
      if (pedido.itens.length > 0) acoes.push({ tipo: 'finalizar' });
      else partes.push(variar(sessaoId, 'pergunta_mais_algo'));
      break;
    default:
      break;
  }
}

function resolverPendencia({ memoria, textoPrep, texto, acoes, partes, sessaoId }) {
  const p = memoria.pendencia;
  const disseSim = /^(sim|isso|pode|confirmo|confirma|exato|ss|s|uhum|aham|ok|blz|beleza|claro|manda|correto|certo|isso mesmo|pode ser)\b/.test(textoPrep);
  const disseNao = /^(nao|n|negativo|melhor nao|deixa|esquece|errado)\b/.test(textoPrep);

  if (p.tipo === 'confirmar_qtd') {
    if (disseSim) {
      acoes.push({ tipo: 'adicionar', item: nomeDoItem(p.dados.id), quantidade: p.dados.quantidade });
      partes.push(variar(sessaoId, 'itens_adicionados', {
        lista: `${p.dados.quantidade}x ${nomeDoItem(p.dados.id)}`,
      }));
      memoria.pendencia = null;
      return true;
    }
    if (disseNao) {
      memoria.pendencia = null;
      partes.push(variar(sessaoId, 'pergunta_mais_algo'));
      return true;
    }
    // Respondeu um número? "não, são 2" / "só 2"
    const m = textoPrep.match(/\b(\d+|uma?|duas|tres|quatro)\b/);
    if (m) {
      const mapa = { um: 1, uma: 1, duas: 2, tres: 3, quatro: 4 };
      const qtd = /^\d+$/.test(m[1]) ? Number(m[1]) : mapa[m[1]];
      if (qtd) {
        acoes.push({ tipo: 'adicionar', item: nomeDoItem(p.dados.id), quantidade: qtd });
        partes.push(variar(sessaoId, 'itens_adicionados', { lista: `${qtd}x ${nomeDoItem(p.dados.id)}` }));
        memoria.pendencia = null;
        return true;
      }
    }
    return false;
  }

  if (p.tipo === 'escolher_item') {
    // Escolha entre pizzas: procura o nome na resposta.
    const opcoes = p.dados.ambiguoEntre;
    const texto2 = textoPrep;
    const escolhido = opcoes.find((id) => {
      const nome = nomeDoItem(id).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const ultimaPalavra = nome.split(' ').at(-1);
      return texto2.includes(ultimaPalavra);
    });
    if (escolhido) {
      acoes.push({ tipo: 'adicionar', item: nomeDoItem(escolhido), quantidade: 1 });
      partes.push(variar(sessaoId, 'itens_adicionados', { lista: `1x ${nomeDoItem(escolhido)}` }));
      memoria.pendencia = null;
      return true;
    }
    return false;
  }

  return false;
}

function montarSaida(partes, acoes, naoEntendeu) {
  return {
    resposta: partes.filter(Boolean).join('\n\n'),
    acoes,
    naoEntendeu,
  };
}
