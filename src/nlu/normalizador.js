// Normalização de português de WhatsApp.
//
// Cliente real escreve "qro 2 calabreza pfv" e espera ser entendido.
// Tudo que o cérebro local enxerga passa por aqui primeiro, então esta é
// a camada que decide se o resto do sistema trabalha com ruído ou não.

/** Minúsculas, sem acento, espaços colapsados. */
export function normalizar(texto) {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s?!,.$/-]/g, ' ') // emoji e símbolos viram espaço
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gírias e abreviações de chat → forma canônica.
 * A lista vem de conversa real de delivery, não de dicionário.
 */
const GIRIAS = new Map(Object.entries({
  vc: 'voce', vcs: 'voces', voce: 'voce', ce: 'voce', ce: 'voce',
  eae: 'oi', eai: 'oi', salve: 'oi', on: 'online',
  q: 'que', pq: 'porque', oq: 'o que',
  qro: 'quero', kero: 'quero', qeru: 'quero', qria: 'queria', keria: 'queria',
  vo: 'vou', to: 'estou', ta: 'esta', tao: 'estao',
  n: 'nao', naum: 'nao', nn: 'nao', ñ: 'nao',
  eh: 'e', soh: 'so',
  tb: 'tambem', tbm: 'tambem',
  obg: 'obrigado', obgd: 'obrigado', brigado: 'obrigado', brigadao: 'obrigado',
  vlw: 'valeu', flw: 'falou', blz: 'beleza',
  pfv: 'por favor', pfvr: 'por favor', porfavor: 'por favor', pf: 'por favor',
  qnt: 'quanto', qto: 'quanto', qnto: 'quanto', qtos: 'quantos',
  qdo: 'quando', qnd: 'quando', qndo: 'quando',
  hj: 'hoje', dps: 'depois', agr: 'agora', amanha: 'amanha',
  mt: 'muito', mto: 'muito', mtos: 'muitos',
  aki: 'aqui', axo: 'acho', dnv: 'de novo',
  refri: 'refrigerante', cerva: 'cerveja',
  msm: 'mesmo', cmg: 'comigo', ctz: 'certeza',
  add: 'adicionar', vdd: 'verdade', sla: 'sei la',
  fzr: 'fazer', fazr: 'fazer',
  entrga: 'entrega', endereco: 'endereco', endreco: 'endereco',
}));

/** "boaaaa noiteee" → "boa noite". Letra repetida 3+ vezes vira uma. */
function achatarRepeticoes(texto) {
  return texto.replace(/(.)\1{2,}/g, '$1');
}

/** Pipeline completo: normaliza, achata e traduz gírias token a token. */
export function preparar(texto) {
  const base = achatarRepeticoes(normalizar(texto));
  return base
    .split(' ')
    .map((t) => GIRIAS.get(t) ?? t)
    .join(' ');
}

/** Tokens de palavra (mantém dígitos; descarta pontuação). */
export function tokenizar(texto) {
  return preparar(texto).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Distância de edição (Levenshtein) — tolerância a erro de digitação. */
export function distancia(a, b) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = linha[j];
      linha[j] = Math.min(
        linha[j] + 1,
        linha[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      anterior = temp;
    }
  }
  return linha[b.length];
}

/**
 * O token do cliente "parece" com a palavra-alvo?
 * Tolerância proporcional: palavra curta com 2 erros já é outra palavra.
 */
export function tokenParece(token, alvo) {
  if (token === alvo) return true;
  const tolerancia = alvo.length > 7 ? 2 : alvo.length > 4 ? 1 : 0;
  if (tolerancia === 0) return false;
  return Math.abs(token.length - alvo.length) <= tolerancia
      && distancia(token, alvo) <= tolerancia;
}
