# AI WhatsApp Ordering Assistant · Atendente de WhatsApp com IA

*A restaurant WhatsApp assistant that answers customers, builds the order, does the
math, and knows when to call a human — running 100% on your own server, with no
per-message API cost.*

Assistente de WhatsApp para restaurante: responde o cliente, monta o pedido,
calcula o total e sabe a hora de chamar um humano — rodando 100% no seu servidor,
sem custo de API por mensagem.

> The conversation is local. The money is deterministic. Nothing is sent to a
> third-party AI provider, and there is no bill per message.

---

## Why this is different · Por que é diferente

Most chatbot demos are a thin wrapper around a paid LLM API: they stop working the
moment the key runs out of credit, and every message costs money. This one ships a
**local brain** instead.

On startup the server *generates* a corpus of realistic customer messages from a bank
of situation templates (`src/nlu/intencoes.js`) and *trains* an intent classifier in
memory — over **17 million** possible phrasings, sampled down to ~120k training
situations, in about 4 seconds. No API key, no cloud, no cost.

A maioria das demos de chatbot é só uma casca em volta de uma API paga: param de
funcionar quando o crédito acaba e cada mensagem custa dinheiro. Esta traz um
**cérebro local**. Na subida, o servidor *gera* um corpus de mensagens realistas a
partir de moldes de situação e *treina* um classificador de intenção em memória —
mais de **17 milhões** de formas possíveis de dizer, amostradas em ~120 mil situações
de treino, em cerca de 4 segundos. Sem chave, sem nuvem, sem custo.

```bash
npm install     # only dependency: express
npm start       # trains the brain, then serves http://localhost:3000
npm run treinar # train + evaluate on held-out phrases, with a confusion report
```

Training prints an honest number: accuracy on thousands of phrasings the model has
**never seen** during training (a held-out split), so the score is not memorization.

---

## Architecture · Arquitetura

```
message → normalizer → operation extractor → intent classifier → dialog manager → reply
          (typos,       (verb before noun:    (Naive Bayes over   (composes one    (varied,
           slang,        "remove the pizza"    words + bigrams +    reply to        never
           accents)      never adds one)       char-trigrams)      everything said)  repeats)
```

| Path | Responsibility |
|---|---|
| `src/nlu/normalizador.js` | WhatsApp Portuguese → clean tokens (slang, typos, repeated letters) |
| `src/nlu/intencoes.js` | **The training situations** — banks of templates per intent |
| `src/nlu/gerador.js` | Expands templates into the training corpus (seeded, reproducible) |
| `src/nlu/classificador.js` | Naive Bayes intent classifier, from scratch, no dependencies |
| `src/nlu/extrator.js` | Reads cart operations: **verb before product**, so "remove X" never adds X |
| `src/dialogo/gerenciador.js` | Dialog flow, memory, one reply that answers everything the client said |
| `src/dialogo/respostas.js` | Reply bank with variation — never repeats a phrase in a session |
| `src/escalonamento.js` | When to hand off to a human (safety, complaints, explicit requests) |
| `src/pedido.js` | Order state, totals, validation — **deterministic, never the model** |
| `src/cardapio.js` | The only file that changes per client: menu, hours, fees |

### The rule that matters · A regra que importa

**The model talks. The code decides.** The brain only *proposes* actions
(`adicionar`, `remover`, `definir_qtd`, `modalidade`, `pagamento`, `finalizar`);
`pedido.js` validates and executes them. Pricing and order state never depend on the
classifier — a wrong total in front of a customer costs more than the automation saved.

**Safety escalation is not optional.** Any mention of an allergy, feeling sick, an
angry complaint, or a request for a human hands the conversation to a person — and, for
allergies, *freezes the order* so nothing is added while a human confirms ingredients.

---

## Sell it to a new restaurant · Vender para um restaurante novo

1. Edit `src/cardapio.js`: name, hours, delivery fee, items and prices.
2. Add the FAQs that restaurant actually gets, as templates in `src/nlu/intencoes.js`.
3. Adjust opening hours in `dentroDoHorario()` (`server.js`), then `npm run treinar`.

The template bank is the product. Extending coverage means adding *ways of saying
things*, not writing `if/else` — and the held-out score tells you when a new intent is
learned well enough to ship.

---

## Honest limitations · Limitações honestas

This is a strong demo, not a finished SaaS. To serve real customers you still need:

- **Real WhatsApp** — connect to Meta's Cloud API (webhook + sending).
- **Persistence** — order state lives in memory today and resets on restart.
- **Owner console** — view and take over live conversations.
- A local classifier understands *bounded* domains (a restaurant's menu and FAQs)
  extremely well and for free. For open-ended reasoning, the same "model talks, code
  decides" architecture accepts an LLM as a drop-in upgrade — the deterministic core
  and the safety rules stay exactly as they are.

---

Author · Autor: **Joiciano Gomes** — github.com/joicianogomesosares
