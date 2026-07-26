// Extrator de operações sobre o pedido: lê o VERBO antes do produto.
//
// A auditoria que motivou esta reescrita flagrou o bug mais caro do sistema
// antigo: "tira a calabresa" ADICIONAVA uma calabresa, porque o parser achava
// o nome do produto e ignorava o verbo. Aqui a ordem é invertida: primeiro a
// operação (adicionar/remover/ajustar/trocar), depois o alvo.

import { CARDAPIO } from '../cardapio.js';
import { preparar, tokenizar, tokenParece } from './normalizador.js';

// Apelidos por item: como o cliente REALMENTE chama cada produto.
const APELIDOS = {
  'piz-marg':  ['pizza margherita', 'pizza marguerita', 'margherita', 'marguerita', 'margarita', 'marguerida'],
  'piz-calab': ['pizza calabresa', 'pizza calabreza', 'calabresa', 'calabreza'],
  'piz-quatro':['pizza quatro queijos', 'pizza 4 queijos', 'quatro queijos', '4 queijos', 'quatro queijo', 'quatroqueijos', '4queijos'],
  'mas-carb':  ['carbonara', 'espaguete', 'spaghetti', 'espaguete a carbonara'],
  'mas-bolo':  ['bolonhesa', 'talharim', 'talharim a bolonhesa'],
  'ent-bru':   ['bruschetta', 'brusqueta', 'bruscheta', 'bruchetta'],
  'ent-pao':   ['pao de alho', 'pao dalho', 'paozinho de alho'],
  'sob-tira':  ['tiramisu', 'tiramissu', 'tiramisu'],
  'sob-pud':   ['pudim', 'pudim de leite'],
  'beb-ref':   ['refrigerante', 'refri', 'coca', 'coca cola', 'guarana', 'sprite', 'lata de refrigerante'],
  'beb-suc':   ['suco', 'suco natural', 'suco de laranja', 'suco de limao', 'suco de maracuja'],
  'beb-vin':   ['vinho', 'taca de vinho', 'vinho tinto'],
};

// "pizza" sozinho é ambíguo entre as três pizzas.
const GENERICOS = { pizza: ['piz-marg', 'piz-calab', 'piz-quatro'], massa: ['mas-carb', 'mas-bolo'] };

const NUMEROS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, meia: 6,
};

const VERBOS_REMOVER = ['tira', 'tirar', 'tire', 'remove', 'remover', 'remova', 'exclui', 'excluir', 'apaga', 'apagar', 'cancela', 'cancelar', 'anula', 'corta', 'desisti', 'desisto'];
const VERBOS_TROCAR = ['troca', 'trocar', 'troque', 'muda', 'mudar', 'substitui', 'substituir'];
const VERBOS_LIMPAR_TUDO = ['tudo', 'geral', 'pedido todo', 'do zero'];

// Verbos que DEFINEM a quantidade absoluta (não somam nem removem): "deixa 1
// calabresa", "faz 2 margherita", "só 1". Distinguem-se de "quero/adiciona"
// (soma) e de "tira/remove" (subtrai). "muda/passa PARA N" também define — e
// não é troca (troca é "muda X POR Y").
const VERBOS_DEFINIR = ['deixa', 'deixe', 'faz', 'faca', 'faze', 'fica', 'ajusta', 'ajuste'];
const MARCADORES_SO = ['so', 'apenas', 'somente'];

// Ingredientes ≠ itens do cardápio: "sem cebola" é observação para a cozinha,
// não remoção de item do carrinho.
const INGREDIENTES = ['cebola', 'azeitona', 'alho', 'queijo', 'tomate', 'manjericao', 'catupiry', 'gorgonzola', 'parmesao', 'mussarela', 'oregano', 'borda'];

/** Tabela achatada de apelidos, ordenada do mais longo para o mais curto. */
const TABELA = Object.entries(APELIDOS)
  .flatMap(([id, nomes]) => nomes.map((n) => ({ id, apelido: preparar(n), tokens: tokenizar(n) })))
  .sort((a, b) => b.tokens.length - a.tokens.length || b.apelido.length - a.apelido.length);

/**
 * Encontra menções a itens do cardápio nos tokens, com tolerância a typo.
 * Devolve [{id, inicio, fim}] com spans em índices de token, sem sobreposição.
 */
export function encontrarItens(tokens) {
  const usados = new Array(tokens.length).fill(false);
  const achados = [];

  for (const { id, tokens: alvo } of TABELA) {
    for (let i = 0; i + alvo.length <= tokens.length; i++) {
      if (usados.slice(i, i + alvo.length).some(Boolean)) continue;
      const casa = alvo.every((palavra, k) =>
        /^\d/.test(palavra) ? tokens[i + k] === palavra : tokenParece(tokens[i + k], palavra)
      );
      if (casa) {
        achados.push({ id, inicio: i, fim: i + alvo.length - 1 });
        for (let k = i; k <= i + alvo.length - 1; k++) usados[k] = true;
      }
    }
  }

  // Genéricos ("pizza" sem sabor) só valem onde nenhum item específico casou.
  for (const [palavra, ids] of Object.entries(GENERICOS)) {
    for (let i = 0; i < tokens.length; i++) {
      if (!usados[i] && tokenParece(tokens[i], palavra)) {
        achados.push({ id: null, ambiguoEntre: ids, inicio: i, fim: i });
        usados[i] = true;
      }
    }
  }

  return achados.sort((a, b) => a.inicio - b.inicio);
}

/**
 * Quantidade EXPLÍCITA associada a um span, ou null se o cliente não disse
 * número. O null importa: em remoção, "tira a margherita" (sem número) apaga
 * a linha toda, enquanto "tira 1 margherita" tira uma unidade só.
 */
function quantidadePara(tokens, span, usadosPorItem) {
  const candidatos = [span.inicio - 1, span.inicio - 2, span.fim + 1];
  for (const i of candidatos) {
    if (i < 0 || i >= tokens.length || usadosPorItem.has(i)) continue;
    const t = tokens[i].replace(/x$/, '');
    if (/^\d+$/.test(t)) { usadosPorItem.add(i); return Number(t); }
    if (NUMEROS[t] !== undefined && t !== 'meia') { usadosPorItem.add(i); return NUMEROS[t]; }
  }
  return null;
}

/** A janela de tokens antes do span contém algum destes verbos? */
function verboAntes(tokens, span, verbos, janela = 4) {
  for (let i = Math.max(0, span.inicio - janela); i < span.inicio; i++) {
    if (verbos.some((v) => tokenParece(tokens[i], v))) return true;
  }
  return false;
}

/** Há negação ligada ao span? ("nao quero mais a calabresa") */
function negacaoAntes(tokens, span, janela = 4) {
  for (let i = Math.max(0, span.inicio - janela); i < span.inicio; i++) {
    if (tokens[i] === 'nao' || tokens[i] === 'sem') return true;
  }
  return false;
}

/**
 * O cliente quer DEFINIR a quantidade absoluta deste item (não somar)?
 * Cobre "deixa 1 X", "faz 2 X", "só 1 X", "muda/passa para N X" e "X para N".
 * NÃO confunde com troca: "muda X POR Y" usa "por", não "para".
 */
function definirQtdIntencao(tokens, span, janela = 4) {
  const antes = tokens.slice(Math.max(0, span.inicio - janela), span.inicio);
  if (antes.some((t) => MARCADORES_SO.includes(t))) return true;
  if (antes.some((t) => VERBOS_DEFINIR.includes(t))) return true;

  // "muda/passa PARA N" antes do item: "muda para 2 calabresa".
  const jAntes = antes.join(' ');
  if (/\b(passa|passe|passar|muda|mudar|mude)\s+(para|pra|pro|pa)\b/.test(jAntes)) return true;

  // "... para N" logo depois do item, com verbo de ajuste antes: "muda a
  // calabresa para 2". Só conta se há um verbo de ajuste na frase antes do item.
  const depois = tokens.slice(span.fim + 1, span.fim + 1 + janela).join(' ');
  const verboAjusteAntes = tokens
    .slice(0, span.inicio)
    .some((t) => ['passa', 'passar', 'muda', 'mudar', 'mude', 'deixa', 'deixe'].includes(t));
  if (verboAjusteAntes && /\b(para|pra|pro)\s+(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/.test(depois)) {
    return true;
  }
  return false;
}

/** Número que aparece logo DEPOIS do item ("calabresa para 2"), ou null. */
function qtdAposItem(tokens, span, janela = 4) {
  const depois = tokens.slice(span.fim + 1, span.fim + 1 + janela);
  for (const bruto of depois) {
    const t = bruto.replace(/x$/, '');
    if (/^\d+$/.test(t)) return Number(t);
    if (NUMEROS[t] !== undefined && t !== 'meia') return NUMEROS[t];
  }
  return null;
}

/** Idiom "deixa {item} pra la" = desistir do item (verbo + "pra la" em volta). */
function deixaPraLa(tokens, span) {
  const antes = tokens.slice(Math.max(0, span.inicio - 3), span.inicio);
  const depois = tokens.slice(span.fim + 1, span.fim + 4);
  const temDeixa = antes.some((t) => t === 'deixa' || t === 'deixe');
  const temPraLa = [...antes, ...depois].join(' ').includes('pra la')
    || depois.includes('la') || depois.includes('quieto');
  return temDeixa && temPraLa;
}

/**
 * Extrai as operações de carrinho de uma mensagem.
 * Retorna { operacoes, observacoes, ambiguidades }.
 *   operacoes:    [{tipo: 'adicionar'|'remover'|'definir_qtd'|'limpar', id, quantidade}]
 *   observacoes:  ['sem cebola', ...]  (recados para a cozinha)
 *   ambiguidades: [{ambiguoEntre: [ids]}] ("quero uma pizza" → qual?)
 */
export function extrairOperacoes(texto, { itensNoCarrinho = [] } = {}) {
  const tokens = tokenizar(texto);
  const operacoes = [];
  const observacoes = [];
  const ambiguidades = [];

  const textoPrep = preparar(texto);

  // Pergunta/consulta NÃO é pedido. "o vinho é caro?" e "tem tiramisù?" citam o
  // item mas não querem adicioná-lo — só saber. Sem esta trava, toda pergunta
  // enchia o carrinho. A regra: se há verbo de pedido explícito, é pedido; se
  // não há e a frase é interrogativa (ou fala de preço), é consulta.
  const temVerboPedido = /\b(quero|queria|manda|me ve|me da|poe|poem|bota|coloca|adiciona|adiciona ai|traz|vou querer|vou de|pode ser|inclui|adicione|manda ver|me manda)\b/.test(textoPrep);
  const ehPerguntaPreco = /\b(quanto|qto|qual o valor|qual valor|qual o preco|qual preco|quanto custa|quanto e|quanto fica|quanto sai|sai por quanto|vale quanto|e caro|e barato|ta caro|custa|preco)\b/.test(textoPrep);
  const ehInterrogativa = /[?]/.test(texto) || /\b(tem|voces tem|vcs tem|fazem|da pra|tem como)\b/.test(textoPrep);
  const soConsulta = !temVerboPedido && (ehPerguntaPreco || ehInterrogativa);

  // "cancela tudo" / "comeca do zero" — limpa sem precisar de item.
  const temVerboLimpar = VERBOS_REMOVER.some((v) => textoPrep.includes(v))
    || /\b(limpa|zera|esquece|refaz)\b/.test(textoPrep);
  if (temVerboLimpar && VERBOS_LIMPAR_TUDO.some((s) => textoPrep.includes(s))) {
    return { operacoes: [{ tipo: 'limpar' }], observacoes, ambiguidades };
  }

  // Observações de ingrediente: "sem cebola", "tira a azeitona".
  for (let i = 0; i < tokens.length; i++) {
    const ing = INGREDIENTES.find((x) => tokenParece(tokens[i], x));
    if (!ing) continue;
    const anterior = tokens.slice(Math.max(0, i - 3), i);
    const negado = anterior.includes('sem')
      || anterior.some((t) => VERBOS_REMOVER.some((v) => tokenParece(t, v)))
      || (anterior.includes('nao') && anterior.some((t) => ['gosto', 'quero', 'como'].includes(t)));
    if (negado) observacoes.push(`sem ${ing}`);
  }

  const spans = encontrarItens(tokens);
  const usadosPorItem = new Set();

  // Consulta de preço/disponibilidade que cita itens específicos: devolve os
  // itens para o gerenciador informar o preço — sem adicionar nada ao carrinho.
  if (soConsulta) {
    const itensCitados = spans.filter((s) => s.id !== null).map((s) => s.id);
    return { operacoes: [], observacoes, ambiguidades: [], consultaItens: itensCitados };
  }

  // "queijo" também é ingrediente; se casou como observação, não vira item.
  const spansValidos = spans.filter((s) => {
    if (s.id === null) return true;
    const trecho = tokens.slice(s.inicio, s.fim + 1).join(' ');
    return !(observacoes.length && trecho === 'queijo');
  });

  for (const span of spansValidos) {
    if (span.id === null) {
      // "passa"/"muda" casam por typo-tolerância com o genérico "massa". Quando
      // vêm seguidos de "para/pra" é o verbo de ajuste ("passa para 2 X"), não
      // um pedido de massa — não gera ambiguidade nem pendência falsa.
      const tokenGen = tokens[span.inicio];
      const seguinte = tokens[span.fim + 1];
      if (['passa', 'passe', 'passar', 'muda', 'mudar', 'mude'].includes(tokenGen)
          && ['para', 'pra', 'pro'].includes(seguinte)) {
        continue;
      }
      // Genérico: só é ambiguidade real se for pedido de adição.
      if (!verboAntes(tokens, span, VERBOS_REMOVER) && !negacaoAntes(tokens, span)) {
        ambiguidades.push({ ambiguoEntre: span.ambiguoEntre });
      } else if (itensNoCarrinho.length === 1) {
        // "tira a pizza" com uma única pizza no carrinho: sem ambiguidade.
        operacoes.push({ tipo: 'remover', id: itensNoCarrinho[0] });
      }
      continue;
    }

    const remover = verboAntes(tokens, span, VERBOS_REMOVER)
      || negacaoAntes(tokens, span)
      || deixaPraLa(tokens, span);
    const trocar = verboAntes(tokens, span, VERBOS_TROCAR);
    const qtdExplicita = quantidadePara(tokens, span, usadosPorItem);

    // Define ANTES de trocar: "muda para 2 X" é ajuste de quantidade, não troca.
    const definir = !remover && definirQtdIntencao(tokens, span);
    const qtdDefinir = definir ? (qtdExplicita ?? qtdAposItem(tokens, span)) : null;

    if (remover) {
      // "deixa a calabresa pra lá" com carrinho vazio = só não adiciona.
      if (itensNoCarrinho.includes(span.id)) {
        operacoes.push({ tipo: 'remover', id: span.id, quantidade: qtdExplicita });
      }
    } else if (definir && qtdDefinir != null) {
      // Item já no carrinho: define a quantidade absoluta. Fora do carrinho:
      // definir uma linha inexistente equivale a adicioná-la com essa quantidade.
      operacoes.push({
        tipo: itensNoCarrinho.includes(span.id) ? 'definir_qtd' : 'adicionar',
        id: span.id,
        quantidade: qtdDefinir,
      });
    } else if (trocar && itensNoCarrinho.includes(span.id)) {
      operacoes.push({ tipo: 'remover', id: span.id, quantidade: null });
    } else if (!soConsulta) {
      operacoes.push({ tipo: 'adicionar', id: span.id, quantidade: qtdExplicita ?? 1 });
    }
  }

  // "troca a margherita por calabresa": remover + adicionar já saem acima
  // (margherita com verbo trocar e no carrinho → remove; calabresa → adiciona).

  // "deixa so 2", "no total 2", "2 no total", "passa para 2" sem citar item:
  // ajuste de quantidade contextual. Só faz sentido com UM item no carrinho —
  // com vários, não dá pra saber qual ajustar.
  if (operacoes.length === 0 && spansValidos.length === 0 && itensNoCarrinho.length === 1) {
    const NUM = '(\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)';
    // Marcador ANTES do número: "no total 2", "passa para 2", "só 2", "fica em 3".
    const reAntes = new RegExp(
      `\\b(?:no total|total de|total|ao todo|fica em|fica|deixa em|deixa|passa (?:para|pra)|muda (?:para|pra)|passa|muda|so|apenas|somente|para|pra)\\s+${NUM}\\b`
    );
    // Número ANTES do marcador: "2 no total", "2 ao todo".
    const rePos = new RegExp(`\\b${NUM}\\s+(?:no total|ao todo|no final)\\b`);
    const pedeAjuste = /\b(so|apenas|somente|muda|corrige|diminui|aumenta|deixa|no total|total|fica|passa|ao todo)\b/.test(textoPrep);
    const m = textoPrep.match(reAntes) || textoPrep.match(rePos);
    if (m && pedeAjuste) {
      const qtd = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMEROS[m[1]];
      if (qtd) operacoes.push({ tipo: 'definir_qtd', id: itensNoCarrinho[0], quantidade: qtd });
    }
  }

  return { operacoes, observacoes, ambiguidades, consultaItens: [] };
}

/** Preço de um item, formatado em reais com vírgula. */
export function precoDoItem(id) {
  const item = CARDAPIO.find((i) => i.id === id);
  if (!item) return null;
  return { nome: item.nome, preco: item.preco, texto: `R$ ${item.preco.toFixed(2).replace('.', ',')}` };
}

/**
 * Remove interjeições iniciais ("eh", "é", "olha", "ah"...) que o cliente digita
 * antes do endereço e que não fazem parte do logradouro. Aplica duas vezes para
 * pegar "eh olha rua...". Não remove "o"/"a" para não comer início de endereço.
 */
function descartarInterjeicoesIniciais(texto) {
  const re = /^(?:eh|é|e|ah|ah|ha|opa|olha|olhe|entao|então|hmm+|entaum|ó|uai|entam)\b[\s,.:-]*/i;
  let t = texto.trim();
  t = t.replace(re, '').trim();
  t = t.replace(re, '').trim();
  return t;
}

/** Endereço: rua/av + número, ou frase introduzida por "endereço é". */
export function extrairEndereco(textoOriginal) {
  const t = descartarInterjeicoesIniciais(textoOriginal);
  const re = /\b(rua|r\.|av\.?|avenida|travessa|alameda|rodovia|estrada)\s+[^,]{2,50}?,?\s*(n[º°o.]?\s*)?\d+/i;
  const m = t.match(re);
  if (m) return t; // devolve o texto completo: complemento importa para o entregador
  const intro = t.match(/(?:endereco|endereço)\s*(?:e|é|:)?\s*(.{8,})/i);
  if (intro) return intro[1].trim();
  return null;
}

/** Forma de pagamento mencionada, se houver. */
export function extrairPagamento(texto) {
  const t = preparar(texto);
  if (/\bpix\b/.test(t)) return 'Pix';
  if (/\b(cartao|credito|debito|maquininha)\b/.test(t)) return 'Cartão na entrega';
  if (/\b(dinheiro|especie|troco)\b/.test(t)) return 'Dinheiro';
  return null;
}

export function nomeDoItem(id) {
  return CARDAPIO.find((i) => i.id === id)?.nome ?? id;
}
