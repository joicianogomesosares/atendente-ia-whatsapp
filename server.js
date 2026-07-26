import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { responder, modoAtual, inicializar, obterEstatisticas, reiniciarSessao } from './src/agente.js';
import { ESTABELECIMENTO } from './src/cardapio.js';
import {
  obterPedido, adicionarItem, removerItem, definirModalidade, definirPagamento,
  resumoPedido, finalizarPedido, pendencias, calcularTotais, reiniciar,
  definirQuantidade, limparItens, adicionarObservacao, congelarPedido,
} from './src/pedido.js';
import { avaliarEscalonamento, mensagemDeEscalonamento } from './src/escalonamento.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const conversas = new Map();
const semEntender = new Map();

function historicoDe(sessaoId) {
  if (!conversas.has(sessaoId)) conversas.set(sessaoId, []);
  return conversas.get(sessaoId);
}

/** O restaurante está aberto? Simplificado: 18h–23h30, terça a domingo. */
function dentroDoHorario(agora = new Date()) {
  const diaSemana = agora.getDay(); // 0 = domingo, 1 = segunda
  if (diaSemana === 1) return false;
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  return minutos >= 18 * 60 && minutos <= 23 * 60 + 30;
}

/** Executa as ações que o agente sugeriu. O agente propõe, aqui a gente valida. */
function aplicarAcoes(sessaoId, acoes = []) {
  const efeitos = [];

  for (const acao of acoes) {
    switch (acao.tipo) {
      case 'adicionar': {
        const r = adicionarItem(sessaoId, acao.item, acao.quantidade ?? 1);
        efeitos.push(r.ok ? `+ ${r.quantidade}x ${r.item}` : `! ${r.motivo}`);
        break;
      }
      case 'remover': {
        const r = removerItem(sessaoId, acao.item, acao.quantidade ?? null);
        efeitos.push(r.ok ? `- ${r.item}` : `! ${r.motivo}`);
        break;
      }
      case 'definir_qtd': {
        const r = definirQuantidade(sessaoId, acao.item, acao.quantidade);
        efeitos.push(r.ok ? `= ${r.quantidade}x ${r.item}` : `! ${r.motivo}`);
        break;
      }
      case 'limpar':
        limparItens(sessaoId);
        efeitos.push('limpar');
        break;
      case 'observacao':
        adicionarObservacao(sessaoId, acao.texto);
        efeitos.push(`obs: ${acao.texto}`);
        break;
      case 'modalidade':
        definirModalidade(sessaoId, acao.valor, acao.endereco ?? null);
        efeitos.push(`modalidade: ${acao.valor}`);
        break;
      case 'pagamento':
        definirPagamento(sessaoId, acao.valor);
        efeitos.push(`pagamento: ${acao.valor}`);
        break;
      case 'mostrar_resumo':
        efeitos.push('resumo');
        break;
      case 'finalizar':
        efeitos.push('finalizar');
        break;
    }
  }

  return efeitos;
}

app.get('/api/config', (_req, res) => {
  res.json({
    estabelecimento: ESTABELECIMENTO,
    modo: modoAtual,
    cerebro: obterEstatisticas(),
    aberto: dentroDoHorario(),
  });
});

app.post('/api/mensagem', async (req, res) => {
  try {
    const { sessaoId = 'demo', texto } = req.body ?? {};
    if (!texto?.trim()) return res.status(400).json({ erro: 'Mensagem vazia.' });

    const historico = historicoDe(sessaoId);
    historico.push({ autor: 'cliente', texto });

    const aberto = dentroDoHorario();
    const pedido = obterPedido(sessaoId);

    // 1. Escalonamento vem ANTES do agente. Se precisa de humano, o robô
    //    não deve tentar responder e piorar a situação.
    const decisao = avaliarEscalonamento({
      mensagem: texto,
      tentativasSemEntender: semEntender.get(sessaoId) ?? 0,
      totalMensagens: historico.length,
      dentroDoHorario: aberto,
      pedido,
    });

    if (decisao.escalar) {
      // Segurança (alergia, passou mal): congela o pedido — nenhuma mutação
      // até um humano assumir. É o que impede o bug histórico de adicionar
      // o alérgeno ao carrinho de quem acabou de relatar alergia.
      if (decisao.congelarPedido) congelarPedido(sessaoId);

      const msg = decisao.mensagem ?? mensagemDeEscalonamento(decisao.motivo, aberto);
      historico.push({ autor: 'agente', texto: msg });
      semEntender.set(sessaoId, 0);
      return res.json({
        resposta: msg,
        escalado: true,
        motivo: decisao.motivo,
        pedido: estadoPublico(sessaoId),
      });
    }

    // Pedido congelado por segurança: não mexe em nada até o humano assumir.
    if (pedido.congelado) {
      const msg = 'Seu caso está com a equipe (por causa da alergia, não mexo em nada por aqui). Já já alguém te responde! 🙏';
      historico.push({ autor: 'agente', texto: msg });
      return res.json({
        resposta: msg,
        escalado: true,
        motivo: 'seguranca',
        pedido: estadoPublico(sessaoId),
      });
    }

    // 2. Agente responde.
    const saida = await responder(historico, { pedido });

    semEntender.set(
      sessaoId,
      saida.naoEntendeu ? (semEntender.get(sessaoId) ?? 0) + 1 : 0
    );

    // 3. Aplica as ações no estado do pedido.
    const efeitos = aplicarAcoes(sessaoId, saida.acoes);

    let resposta = saida.resposta;

    if (efeitos.includes('finalizar')) {
      const r = finalizarPedido(sessaoId);
      resposta = r.ok
        ? `${r.resumo}\n\nPedido ${r.pedido.numero} confirmado! ✅`
        : `Quase lá! Só falta: ${r.faltando.join(', ')}.`;
    } else if (efeitos.includes('resumo')) {
      const resumo = resumoPedido(obterPedido(sessaoId));
      resposta = resposta ? `${resposta}\n\n${resumo}` : resumo;
    }

    historico.push({ autor: 'agente', texto: resposta });

    res.json({
      resposta,
      escalado: false,
      efeitos,
      pedido: estadoPublico(sessaoId),
    });
  } catch (erro) {
    console.error('[servidor] erro ao processar mensagem:', erro);
    res.status(500).json({ erro: 'Falha ao processar a mensagem.' });
  }
});

app.post('/api/reiniciar', (req, res) => {
  const { sessaoId = 'demo' } = req.body ?? {};
  conversas.delete(sessaoId);
  semEntender.delete(sessaoId);
  reiniciar(sessaoId);
  reiniciarSessao(sessaoId);
  res.json({ ok: true });
});

function estadoPublico(sessaoId) {
  const pedido = obterPedido(sessaoId);
  return {
    itens: pedido.itens,
    modalidade: pedido.modalidade,
    pagamento: pedido.pagamento,
    finalizado: pedido.finalizado,
    numero: pedido.numero ?? null,
    totais: calcularTotais(pedido),
    pendencias: pendencias(pedido),
  };
}

const PORTA = process.env.PORT || 3000;

// Treina o cérebro local ANTES de aceitar conexões: a primeira mensagem do
// cliente não pode pagar o custo do treino.
const stats = inicializar();

app.listen(PORTA, () => {
  console.log(`\n  ${ESTABELECIMENTO.nome} — atendente virtual`);
  console.log(`  http://localhost:${PORTA}`);
  console.log(`  modo: cérebro local (sem API)`);
  console.log(`  espaço de situações: ${stats.espacoCombinatorio.toLocaleString('pt-BR')} combinações possíveis`);
  console.log(`  treinado com: ${stats.situacoesTreino.toLocaleString('pt-BR')} situações (${stats.tempoMs}ms)`);
  console.log(`  acurácia held-out: ${(stats.acuraciaHeldOut * 100).toFixed(1)}% em ${stats.situacoesTeste} frases nunca vistas\n`);
});
