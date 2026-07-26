// Treino e avaliação do cérebro local, com relatório.
//
//   npm run treinar            → 250 mil situações
//   npm run treinar -- 500000  → meio milhão
//
// Gera o corpus, treina, avalia num held-out de 5% e imprime as confusões
// mais comuns — é este relatório que diz ONDE adicionar moldes novos.

import { writeFileSync, mkdirSync } from 'node:fs';
import { gerarCorpus } from '../src/nlu/gerador.js';
import { treinar, avaliar } from '../src/nlu/classificador.js';

const alvo = Number(process.argv[2]) || 250000;

console.log(`\nGerando corpus (alvo: ${alvo.toLocaleString('pt-BR')} situações)...`);
let t0 = Date.now();
const { corpus, espacoTotal } = gerarCorpus({ alvoTotal: alvo, seed: 42 });
console.log(`  espaço combinatório total: ${espacoTotal.toLocaleString('pt-BR')} frases possíveis`);
console.log(`  geradas (únicas): ${corpus.length.toLocaleString('pt-BR')} em ${Date.now() - t0}ms`);

const corte = Math.floor(corpus.length * 0.95);
const treino = corpus.slice(0, corte);
const teste = corpus.slice(corte);

console.log(`\nTreinando com ${treino.length.toLocaleString('pt-BR')} situações...`);
t0 = Date.now();
const modelo = treinar(treino);
console.log(`  vocabulário: ${modelo.vocabSize.toLocaleString('pt-BR')} características em ${Date.now() - t0}ms`);

console.log(`\nAvaliando em ${teste.length.toLocaleString('pt-BR')} frases que o modelo NUNCA viu...`);
t0 = Date.now();
const r = avaliar(modelo, teste);
console.log(`  acurácia: ${(r.acuracia * 100).toFixed(2)}% (${Date.now() - t0}ms)`);

if (r.confusoes.length) {
  console.log('\nConfusões mais comuns (real → previsto):');
  for (const [par, n] of r.confusoes) console.log(`  ${String(n).padStart(4)}x  ${par}`);
}

mkdirSync('dados', { recursive: true });
writeFileSync('dados/amostra-corpus.txt',
  corpus.slice(0, 3000).map((c) => `${c.intencao}\t${c.texto}`).join('\n'));
writeFileSync('dados/relatorio-treino.json', JSON.stringify({
  data: new Date().toISOString(),
  espacoCombinatorio: espacoTotal,
  geradas: corpus.length,
  treino: treino.length,
  teste: teste.length,
  acuracia: r.acuracia,
  confusoes: r.confusoes,
}, null, 2));

console.log('\nAmostra do corpus em dados/amostra-corpus.txt, relatório em dados/relatorio-treino.json\n');
