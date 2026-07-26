# Atendente Virtual com IA para WhatsApp

Atendimento automático para restaurante: responde dúvidas, monta o pedido,
calcula o total, define entrega ou retirada e fecha o pedido — 24h por dia.

Projeto de demonstração construído para ser mostrado a cliente. A interface
imita o WhatsApp e um painel lateral mostra o pedido sendo montado em tempo real.

![modo de uso](#) <!-- coloque aqui o print ou o GIF da demo -->

---

## Rodar

```bash
npm install
npm start
```

Abra <http://localhost:3000>.

**Roda sem chave de API.** Sem `ANTHROPIC_API_KEY` o projeto entra em modo mock
e responde por regras. Isso é proposital: a demonstração nunca trava na frente
do cliente por falta de internet, cota ou crédito.

Para ligar a IA de verdade:

```bash
cp .env.example .env
# preencha ANTHROPIC_API_KEY
```

---

## Como está organizado

| Arquivo | Responsabilidade |
|---|---|
| `server.js` | HTTP, sessões e orquestração |
| `src/agente.js` | Interpreta a mensagem (Claude ou mock) e **sugere** ações |
| `src/pedido.js` | Estado do pedido, cálculo e validação — **determinístico** |
| `src/cardapio.js` | Dados do estabelecimento — o único arquivo que muda por cliente |
| `src/escalonamento.js` | Quando passar a conversa para um humano |
| `public/` | Interface WhatsApp + painel da cozinha |

### A decisão de arquitetura que importa

**O modelo conversa. O código calcula.**

O agente nunca soma preço nem fecha pedido. Ele devolve *ações sugeridas*
(`adicionar`, `remover`, `modalidade`, `pagamento`, `finalizar`) e o
`pedido.js` valida e executa. LLM que calcula total erra em algum momento —
e errar dinheiro na frente do cliente derruba a confiança na solução inteira.

---

## Vender para um restaurante novo

1. Edite `src/cardapio.js`: nome, horário, taxa, itens e preços.
2. Ajuste o horário de funcionamento em `dentroDoHorario()` no `server.js`.
3. Rode, teste, grave o vídeo.

Leva menos de uma hora por cliente. É isso que torna o modelo viável:
o custo marginal do segundo cliente é quase zero.

---

## O que falta para ir a produção

Isto é uma demonstração honesta, não um produto acabado. Para atender de verdade:

- [ ] **WhatsApp real** — conectar à Cloud API da Meta (webhook + envio)
- [ ] **Persistência** — hoje o estado vive em memória e some ao reiniciar
- [ ] **Regra de escalonamento** — ver `src/escalonamento.js`, ainda não implementada
- [ ] **Painel do dono** — visualizar e assumir conversas
- [ ] **Horários por dia da semana** — hoje é uma faixa única

---

## Roteiro do vídeo de 90 segundos

O vídeo é a peça de venda. Sem ele, o projeto não converte.

| Tempo | O que mostrar |
|---|---|
| 0–10s | A tela do WhatsApp parada. "Seu cliente manda mensagem às 22h." |
| 10–35s | Cliente pede 2 pizzas e uma sobremesa. Bot responde na hora. |
| 35–55s | **Painel lateral** montando o pedido e somando sozinho. |
| 55–75s | Entrega, endereço, pagamento. Resumo final com o total. |
| 75–90s | "Isso rodando no WhatsApp do seu restaurante. R$ 800 e está no ar." |

Grave com OBS ou a gravação de tela do Windows (`Win+Alt+R`). Sem narração,
com legenda — a maioria assiste sem som.
