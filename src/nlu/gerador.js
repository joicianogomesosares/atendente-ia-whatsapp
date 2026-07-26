// Gerador de situações de treino.
//
// Expande os moldes de intencoes.js em frases concretas. O espaço combinatório
// total passa fácil de um milhão de frases; treinar com TODAS seria só mais
// lento, não mais inteligente — então geramos uma amostra grande e balanceada
// por intenção, com semente fixa para o treino ser reproduzível.

import { INTENCOES, FILLERS } from './intencoes.js';
import { preparar } from './normalizador.js';

/** PRNG com semente (mulberry32): mesmo seed → mesmo corpus → mesmo modelo. */
export function criarRng(seed = 42) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Divide o molde em partes: texto fixo, grupos [a|b] e slots {nome}. */
function analisarMolde(molde) {
  const partes = [];
  const re = /\[([^\]]*)\]|\{(\w+)\}/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(molde)) !== null) {
    if (m.index > ultimo) partes.push({ tipo: 'fixo', valor: molde.slice(ultimo, m.index) });
    if (m[1] !== undefined) partes.push({ tipo: 'grupo', opcoes: m[1].split('|') });
    else partes.push({ tipo: 'slot', nome: m[2] });
    ultimo = re.lastIndex;
  }
  if (ultimo < molde.length) partes.push({ tipo: 'fixo', valor: molde.slice(ultimo) });
  return partes;
}

function opcoesDe(parte) {
  if (parte.tipo === 'fixo') return [parte.valor];
  if (parte.tipo === 'grupo') return parte.opcoes;
  return FILLERS[parte.nome] ?? [`{${parte.nome}}`];
}

/** Quantas frases distintas o molde pode gerar. */
export function tamanhoDoEspaco(molde) {
  return analisarMolde(molde).reduce((n, p) => n * opcoesDe(p).length, 1);
}

// Decorações: o que o cliente real põe EM VOLTA da frase sem mudar o sentido.
// Multiplicam o espaço combinatório e ensinam o classificador a ignorar ruído.
const PREFIXOS = ['', '', '', '', 'amigo ', 'mano ', 'moco ', 'moca ', 'entao ', 'olha ', 'escuta ', 'ah ', 'hmm ', 'tipo ', 'me ajuda ', 'rapidinho ', 'so uma coisa ', 'deixa eu ver ', 'por gentileza '];
const SUFIXOS = ['', '', '', '', ' por favor', ' por gentileza', ' pfv', ' ai', ' hein', ' viu', ' rapidinho', ' quando puder', ' obrigado', ' valeu', ' urgente', ' kk', ' rs', '!!', '??', ' ...'];

/** Gera uma frase aleatória do molde, com decoração ocasional. */
function gerarUma(partes, rng) {
  const nucleo = partes
    .map((p) => {
      const ops = opcoesDe(p);
      return ops[Math.floor(rng() * ops.length)];
    })
    .join('');
  const pre = PREFIXOS[Math.floor(rng() * PREFIXOS.length)];
  const suf = SUFIXOS[Math.floor(rng() * SUFIXOS.length)];
  return preparar(pre + nucleo + suf);
}

/**
 * Gera o corpus completo: [{texto, intencao}], balanceado por intenção.
 * `alvoTotal` é o número aproximado de situações desejadas no total.
 */
export function gerarCorpus({ alvoTotal = 150000, seed = 42 } = {}) {
  const rng = criarRng(seed);
  const porIntencao = Math.ceil(alvoTotal / INTENCOES.length);

  const corpus = [];
  let espacoTotal = 0;

  for (const intencao of INTENCOES) {
    // As decorações multiplicam o espaço de cada molde.
    const fatorDecoracao = new Set(PREFIXOS).size * new Set(SUFIXOS).size;
    const espacoIntencao = intencao.exemplos.reduce((s, m) => s + tamanhoDoEspaco(m) * fatorDecoracao, 0);
    espacoTotal += espacoIntencao;

    const vistos = new Set();
    const moldes = intencao.exemplos.map(analisarMolde);
    // Tenta até 4x o alvo: moldes pequenos esgotam as combinações antes do alvo.
    const tentativas = porIntencao * 4;

    for (let t = 0; t < tentativas && vistos.size < porIntencao; t++) {
      const partes = moldes[Math.floor(rng() * moldes.length)];
      const frase = gerarUma(partes, rng);
      if (frase && !vistos.has(frase)) {
        vistos.add(frase);
        corpus.push({ texto: frase, intencao: intencao.nome });
      }
    }
  }

  // Embaralha (Fisher-Yates) para o held-out não ficar enviesado por intenção.
  for (let i = corpus.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [corpus[i], corpus[j]] = [corpus[j], corpus[i]];
  }

  return { corpus, espacoTotal };
}
