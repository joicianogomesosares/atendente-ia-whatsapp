// Cardápio do estabelecimento.
//
// Este é o único arquivo que muda de cliente para cliente. Ao vender para um
// restaurante novo, você troca este conteúdo e o resto do sistema funciona igual.
// É o que te permite entregar em horas em vez de dias.

export const ESTABELECIMENTO = {
  nome: 'Cantina do Marco',
  horario: 'Terça a domingo, das 18h às 23h30',
  entrega: { taxa: 7.0, tempoMedio: '40 a 55 minutos', raioKm: 6 },
  retirada: { tempoMedio: '20 minutos' },
  pagamento: ['Pix', 'Cartão na entrega', 'Dinheiro'],
};

export const CARDAPIO = [
  { id: 'piz-marg',  categoria: 'Pizza',    nome: 'Pizza Margherita',        preco: 49.9, descricao: 'Molho de tomate San Marzano, mussarela de búfala e manjericão' },
  { id: 'piz-calab', categoria: 'Pizza',    nome: 'Pizza Calabresa',         preco: 52.9, descricao: 'Calabresa artesanal, cebola roxa e azeitona preta' },
  { id: 'piz-quatro',categoria: 'Pizza',    nome: 'Pizza Quatro Queijos',    preco: 58.9, descricao: 'Mussarela, gorgonzola, parmesão e catupiry' },
  { id: 'mas-carb',  categoria: 'Massa',    nome: 'Espaguete à Carbonara',   preco: 46.0, descricao: 'Guanciale, ovo caipira e pecorino romano' },
  { id: 'mas-bolo',  categoria: 'Massa',    nome: 'Talharim à Bolonhesa',    preco: 42.0, descricao: 'Ragu de carne cozido por 6 horas' },
  { id: 'ent-bru',   categoria: 'Entrada',  nome: 'Bruschetta (4 unidades)', preco: 24.0, descricao: 'Tomate, alho, manjericão e azeite extravirgem' },
  { id: 'ent-pao',   categoria: 'Entrada',  nome: 'Pão de Alho Gratinado',   preco: 18.0, descricao: 'Com mussarela derretida' },
  { id: 'sob-tira',  categoria: 'Sobremesa',nome: 'Tiramisù',                preco: 22.0, descricao: 'Receita tradicional, feito na casa' },
  { id: 'sob-pud',   categoria: 'Sobremesa',nome: 'Pudim de Leite',          preco: 16.0, descricao: 'Fatia generosa' },
  { id: 'beb-ref',   categoria: 'Bebida',   nome: 'Refrigerante Lata',       preco: 7.0,  descricao: 'Coca, Guaraná ou Sprite' },
  { id: 'beb-suc',   categoria: 'Bebida',   nome: 'Suco Natural 500ml',      preco: 12.0, descricao: 'Laranja, limão ou maracujá' },
  { id: 'beb-vin',   categoria: 'Bebida',   nome: 'Vinho Tinto (taça)',      preco: 26.0, descricao: 'Malbec argentino' },
];

/** Busca tolerante: aceita id exato, nome parcial e ignora acento/caixa. */
export function buscarItem(termo) {
  if (!termo) return null;
  // ̀-ͯ = marcas de acento combinantes. Escape explícito em vez de
  // caractere literal: sobrevive a copiar/colar e a editor com encoding errado.
  const normalizar = (t) =>
    t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  const alvo = normalizar(termo);
  return (
    CARDAPIO.find((i) => i.id === termo) ||
    CARDAPIO.find((i) => normalizar(i.nome) === alvo) ||
    CARDAPIO.find((i) => normalizar(i.nome).includes(alvo)) ||
    null
  );
}

/** Cardápio formatado para leitura humana — usado no WhatsApp e no prompt. */
export function cardapioEmTexto() {
  const porCategoria = CARDAPIO.reduce((acc, item) => {
    (acc[item.categoria] ??= []).push(item);
    return acc;
  }, {});

  return Object.entries(porCategoria)
    .map(([categoria, itens]) => {
      const linhas = itens.map(
        (i) => `  • ${i.nome} — R$ ${i.preco.toFixed(2)} (${i.descricao})`
      );
      return `${categoria.toUpperCase()}\n${linhas.join('\n')}`;
    })
    .join('\n\n');
}
