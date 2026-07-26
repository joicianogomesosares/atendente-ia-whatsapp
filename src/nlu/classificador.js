// Classificador de intenção — Naive Bayes multinomial, implementado do zero.
//
// Sem API, sem dependência: o "modelo" são contagens de características por
// intenção, aprendidas do corpus gerado. Características: palavras, pares de
// palavras e trigramas de caracteres (os trigramas dão robustez a erro de
// digitação que a palavra inteira não dá — "calabreza" compartilha quase
// todos os trigramas de "calabresa").

import { preparar, tokenizar } from './normalizador.js';

const ALPHA = 0.25; // suavização de Laplace

/** Extrai o saco de características de uma frase. */
export function caracteristicas(texto) {
  const tokens = tokenizar(texto);
  const feats = [];

  for (const t of tokens) feats.push(`w:${t}`);
  for (let i = 0; i < tokens.length - 1; i++) feats.push(`b:${tokens[i]}_${tokens[i + 1]}`);

  for (const t of tokens) {
    if (t.length < 3) continue;
    const p = `#${t}#`;
    for (let i = 0; i <= p.length - 3; i++) feats.push(`c:${p.slice(i, i + 3)}`);
  }

  return feats;
}

/** Treina com [{texto, intencao}] e devolve o modelo. */
export function treinar(corpus) {
  const classes = new Map(); // intencao -> { total, contagens: Map }
  const vocab = new Set();

  for (const { texto, intencao } of corpus) {
    if (!classes.has(intencao)) classes.set(intencao, { total: 0, contagens: new Map() });
    const cls = classes.get(intencao);
    for (const f of caracteristicas(texto)) {
      vocab.add(f);
      cls.total += 1;
      cls.contagens.set(f, (cls.contagens.get(f) ?? 0) + 1);
    }
  }

  return { classes, vocabSize: vocab.size, exemplos: corpus.length };
}

/**
 * Classifica uma frase. Retorna o ranking de intenções e uma medida de
 * confiança. Prior uniforme de propósito: o corpus é balanceado e a
 * frequência de treino não deve enviesar a decisão.
 */
export function classificar(modelo, texto) {
  const feats = caracteristicas(texto);
  if (feats.length === 0) return { melhor: null, ranking: [], confianca: 0 };

  const ranking = [];
  for (const [intencao, cls] of modelo.classes) {
    const denominador = cls.total + ALPHA * modelo.vocabSize;
    let logp = 0;
    for (const f of feats) {
      logp += Math.log((cls.contagens.get(f) ?? 0) + ALPHA) - Math.log(denominador);
    }
    ranking.push({ intencao, logp });
  }

  ranking.sort((a, b) => b.logp - a.logp);

  // Margem entre 1º e 2º lugar, normalizada pelo tamanho da frase:
  // frases longas acumulam log-prob, então sem normalizar a margem cresceria
  // com o tamanho e o limiar não teria significado estável.
  const margem = ranking.length > 1
    ? (ranking[0].logp - ranking[1].logp) / Math.sqrt(feats.length)
    : 1;

  // Cobertura: fração das características que o vencedor já viu no treino.
  const vencedor = modelo.classes.get(ranking[0].intencao);
  const vistas = feats.filter((f) => vencedor.contagens.has(f)).length;
  const cobertura = vistas / feats.length;

  return {
    melhor: ranking[0].intencao,
    ranking: ranking.slice(0, 5),
    margem,
    cobertura,
    confianca: Math.min(1, margem) * cobertura,
  };
}

/** Avaliação simples: acurácia sobre um conjunto rotulado. */
export function avaliar(modelo, conjunto) {
  let acertos = 0;
  const errosPorIntencao = new Map();

  for (const { texto, intencao } of conjunto) {
    const r = classificar(modelo, texto);
    if (r.melhor === intencao) acertos += 1;
    else {
      const chave = `${intencao} → ${r.melhor}`;
      errosPorIntencao.set(chave, (errosPorIntencao.get(chave) ?? 0) + 1);
    }
  }

  const confusoes = [...errosPorIntencao.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return { acuracia: acertos / conjunto.length, total: conjunto.length, confusoes };
}
