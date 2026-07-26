import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { responder, modoAtual } from './src/agente.js';
import { ESTABELECIMENTO } from './src/cardapio.js';
import {
  obterPedido, adicionarItem, removerItem, definirModalidade, definirPagamento,
  resumoPedido, finalizarPedido, pendencias, calcularTotais, reiniciar,
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
        const r = removerItem(sessaoId, acao.item);
        efeitos.push(r.ok ? `- ${r.item}` : `! ${r.motivo}`);
        break;
      }
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
      resposta = `${resposta}\n\n${resumoPedido(obterPedido(sessaoId))}`;
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
app.listen(PORTA, () => {
  console.log(`\n  ${ESTABELECIMENTO.nome} — atendente virtual`);
  console.log(`  http://localhost:${PORTA}`);
  console.log(`  modo: ${modoAtual === 'ia' ? 'IA (Claude)' : 'MOCK (sem chave de API)'}\n`);
});
