// O agente: cérebro 100% LOCAL. Sem API, sem chave, sem custo por mensagem.
//
// Na inicialização ele GERA o corpus de situações de treino (a partir dos
// moldes de nlu/intencoes.js) e TREINA o classificador em memória — sempre o
// mesmo seed, sempre o mesmo modelo. Depois disso, cada mensagem passa por:
//
//   normalizador → extrator de operações → classificador de intenção →
//   gerenciador de diálogo → resposta com variação
//
// O contrato com o servidor é o mesmo de sempre:
//   { resposta: string, acoes: Array<{tipo, ...}>, naoEntendeu?: boolean }
// O agente PROPÕE ações; quem valida e executa é o pedido.js. A conversa é
// livre, o dinheiro é determinístico.

import { gerarCorpus } from './nlu/gerador.js';
import { treinar, avaliar } from './nlu/classificador.js';
import { conduzir, limparMemoria } from './dialogo/gerenciador.js';
import { limparMemoriaDeVariacao } from './dialogo/respostas.js';
import { buscarItem } from './cardapio.js';

export const modoAtual = 'local';

let modelo = null;
let estatisticas = null;

/**
 * Treina o cérebro. Chamado uma vez na subida do servidor.
 * `alvoTotal` controla o tamanho da amostra de treino; o espaço combinatório
 * completo (relatado em `estatisticas`) é muito maior.
 */
export function inicializar({ alvoTotal = Number(process.env.CORPUS_ALVO) || 120000 } = {}) {
  const inicio = Date.now();
  const { corpus, espacoTotal } = gerarCorpus({ alvoTotal, seed: 42 });

  // Held-out de sanidade: 5% fora do treino, avaliados depois.
  const corte = Math.floor(corpus.length * 0.95);
  const treino = corpus.slice(0, corte);
  const teste = corpus.slice(corte);

  modelo = treinar(treino);
  const aval = avaliar(modelo, teste);

  estatisticas = {
    espacoCombinatorio: espacoTotal,
    situacoesGeradas: corpus.length,
    situacoesTreino: treino.length,
    situacoesTeste: teste.length,
    acuraciaHeldOut: aval.acuracia,
    vocabulario: modelo.vocabSize,
    tempoMs: Date.now() - inicio,
  };

  return estatisticas;
}

export function obterEstatisticas() {
  return estatisticas;
}

export async function responder(historico, contexto = {}) {
  if (!modelo) inicializar();

  const texto = historico.at(-1)?.texto ?? '';
  return conduzir({
    sessaoId: contexto.pedido?.sessaoId ?? 'demo',
    texto,
    modelo,
    pedido: contexto.pedido ?? { itens: [] },
  });
}

/** Limpa a memória de diálogo de uma sessão (reinício de conversa). */
export function reiniciarSessao(sessaoId) {
  limparMemoria(sessaoId);
  limparMemoriaDeVariacao(sessaoId);
}

export { buscarItem };
