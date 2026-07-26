// O banco de situações — os "parâmetros" do cérebro local.
//
// Cada intenção tem dezenas de moldes. Um molde é uma frase com grupos de
// alternativas [a|b|c] (a opção vazia é permitida: [|por favor]) e slots
// {item}, {qtd}... preenchidos pelas listas FILLERS. O gerador expande isso
// combinatoriamente: são os moldes que produzem as centenas de milhares de
// situações de treino — e é aqui que se ensina o bot, não em if/else.
//
// REGRA DE OURO ao editar: um molde por FORMA DE DIZER, não por assunto.
// "quanto ficou" e "qual o total" são o mesmo assunto dito de dois jeitos —
// os dois precisam estar aqui, senão o classificador só aprende um.

export const FILLERS = {
  item: [
    'pizza margherita', 'margherita', 'marguerita', 'pizza calabresa',
    'calabresa', 'calabreza', 'pizza quatro queijos', 'quatro queijos',
    '4 queijos', 'carbonara', 'espaguete', 'talharim', 'bolonhesa',
    'bruschetta', 'pao de alho', 'tiramisu', 'pudim', 'refrigerante',
    'coca', 'guarana', 'suco', 'vinho', 'uma pizza', 'pizza',
  ],
  qtd: ['uma', 'duas', 'tres', 'um', 'dois', '1', '2', '3', '4'],
  saudacao: ['oi', 'ola', 'boa noite', 'boa tarde', 'bom dia', 'e ai', 'opa', 'eai'],
  bairro: ['centro', 'no centro', 'no jardim america', 'na aldeota', 'no bairro de fatima', 'aqui perto'],
  ingrediente: ['cebola', 'azeitona', 'alho', 'queijo', 'tomate', 'manjericao', 'catupiry', 'gorgonzola'],
};

/**
 * Intenções e seus moldes.
 * A ordem não importa para o classificador; importa para quem lê.
 */
export const INTENCOES = [
  {
    nome: 'saudacao',
    exemplos: [
      '{saudacao}',
      '{saudacao} [|tudo bem?|tudo bem|td bem|como vai?|beleza?]',
      '{saudacao} [|gente|pessoal|amigo|amiga]',
      'alguem [ai|por ai|me atende|online]?',
      '[oi|ola] [tem alguem ai|alguem responde|atendendo]?',
      'tudo [bem|bom|certo] [|por ai]?',
      '[|{saudacao} ]vim pelo [instagram|face|facebook|anuncio|google]',
      'primeira vez que [peco|compro] [aqui|com voces]',
    ],
  },
  {
    nome: 'despedida',
    exemplos: [
      '[tchau|ate mais|ate logo|falou|fui|adeus|xau]',
      '[tchau|falou] [|obrigado|valeu]',
      'boa noite [pra voce|pra vcs|ai]',
      '[era so isso|so isso mesmo] [tchau|obrigado|valeu]',
      'ate [a proxima|outro dia|amanha]',
    ],
  },
  {
    nome: 'agradecimento',
    exemplos: [
      '[obrigado|obrigada|valeu|obrigadao|gratidao|agradecido]',
      '[muito|mt] obrigado[|a]',
      '[valeu|obrigado] [demais|mesmo|viu|hein]',
      '[show|top|perfeito|otimo|maravilha|excelente] [|obrigado|valeu]',
      '[ta otimo|ficou otimo|ta perfeito] [|obrigado]',
    ],
  },
  {
    nome: 'pedir_cardapio',
    exemplos: [
      '[me manda|manda|me mostra|mostra|quero ver|posso ver|tem como ver] o [cardapio|menu]',
      '[cardapio|menu] [|por favor|ai]',
      'o que [tem|voces tem|vcs tem] [|hoje|de bom|ai]?',
      '[quais sao|quais] as [opcoes|pizzas|massas|sobremesas|bebidas]?',
      'que [pizzas|sabores|massas] [tem|voces fazem|vcs tem]?',
      '[tem|vcs tem|voces tem] [o que|oq] [|hoje|para hoje]?',
      'to [com fome|querendo pedir] o que [tem|vcs sugerem]?',
      'me [ve|fala] [as opcoes|o que tem]',
      '[opcoes|sugestoes] [|por favor]',
      'o que [voce|vc] [recomenda|indica|sugere]?',
      'qual [a melhor|a mais pedida|o carro chefe] [|de voces|da casa]?',
    ],
  },
  {
    nome: 'pedir_item',
    exemplos: [
      '[quero|queria|vou querer|me ve|me manda|manda|traz|me traz] [|{qtd} ]{item} [|por favor]',
      '[pode ser|vai ser|para mim] [|{qtd} ]{item}',
      '{qtd} {item} [|por favor|pra mim]',
      '{item} [|por favor|pra mim]',
      '[me ve|quero|adiciona|poe|bota|coloca] [mais |]{qtd} {item}',
      '[vou de|hoje e|fica] {item}',
      'acho que vou [de|querer|pedir] {item}',
      '[e|mais|também quero|tambem quero|aproveita e poe] {qtd} {item}',
      '[da pra|pode] [incluir|adicionar|por] {item}[| no pedido]?',
      'vou pedir {item} [|e {item}]',
      '{qtd} {item} e {qtd} {item}',
      '{item} e {item} [|por favor]',
      'me anota [ai|] {qtd} {item}',
      '[capricha|manda] [em|] {qtd} {item}',
    ],
  },
  {
    nome: 'remover_item',
    exemplos: [
      '[tira|tire|remove|remova|exclui|apaga|cancela|corta] [a|o|as|os|] {item} [|do pedido|dai|por favor]',
      '[tira|remove] [essa|esse|] {item} [dai|do pedido|agora]',
      'nao quero [mais|] [a|o|] {item} [|nao]',
      'pode [tirar|remover|cancelar] [a|o|] {item}[| do pedido]?',
      'desisti [da|do|de] {item}',
      '[muda ai|melhor nao] tira [a|o] {item}',
      '{item} nao [quero|vou querer] mais',
      'sem [a|o] {item} [|no final das contas|no fim]',
      '[cancela|anula] [a|o] {item} [ai|do pedido|]',
      'errei nao era [para|pra] [ter|por] {item}',
    ],
  },
  {
    nome: 'alterar_quantidade',
    exemplos: [
      '[deixa|quero] so [{qtd}|uma|um]',
      '[muda|troca|corrige] para {qtd}',
      'na verdade [sao|e|eram] [so |]{qtd}',
      'so {qtd} [|por favor|mesmo]',
      '[era|e] para ser [so |]{qtd}',
      '{qtd} [ja basta|esta bom|ta bom|chega]',
      'diminui para {qtd}',
      'aumenta para {qtd}',
      'coloca {qtd} [entao|no lugar|]',
    ],
  },
  {
    nome: 'limpar_pedido',
    exemplos: [
      '[cancela|apaga|limpa|zera] [tudo|o pedido|meu pedido|geral]',
      '[vamos|quero] [comecar|começar] [de novo|do zero]',
      'esquece [tudo|o pedido|o que eu pedi]',
      '[apaga|remove] tudo [ai|] [|e vamos de novo]',
      'nao quero mais nada [disso|] [comeca de novo|]',
      'desisto [de tudo|do pedido todo]',
      'refaz [o pedido|tudo] [do zero|]',
    ],
  },
  {
    nome: 'perguntar_total',
    exemplos: [
      '[quanto|qto] [ficou|deu|da|fica|esta|ta] [|o pedido|tudo|no total|ate agora]?',
      'qual [o total|o valor|o valor total] [|do pedido|ate agora]?',
      '[me fala|fala|passa] o total [|por favor|ai]',
      'quanto [vou pagar|vai dar|custa meu pedido]?',
      '[fechou|deu] em quanto?',
      'total [|por favor|ate agora]?',
      'quanto [esta|ta] [dando|somando] [|ai]?',
      '[soma|calcula] [ai |]para mim [|por favor]',
    ],
  },
  {
    nome: 'ver_resumo',
    exemplos: [
      'o que [eu ja pedi|ja pedi|tem no pedido|tem no meu pedido]?',
      '[me mostra|mostra|resume|repete] [o pedido|meu pedido|o que pedi]',
      '[como|o que] [esta|ta|ficou] [o pedido|meu pedido]?',
      'resumo [do pedido|] [|por favor]',
      '[confere|revisa|le] [ai |]meu pedido [|por favor]',
      'quais itens [tem|estao] [no pedido|ai]?',
    ],
  },
  {
    nome: 'escolher_entrega',
    exemplos: [
      '[e|vai ser|quero|prefiro|pode ser] [para |]entrega [|por favor]',
      '[entrega|delivery] [|por favor]',
      '[pode|podem] [entregar|trazer] [|aqui em casa|na minha casa]?',
      'quero [que entregue|receber em casa|em casa]',
      'manda [na minha casa|aqui em casa|para ca|entregar]',
      'vou querer [em casa|entrega|delivery]',
      'traz [aqui|em casa|para mim] [|por favor]',
    ],
  },
  {
    nome: 'escolher_retirada',
    exemplos: [
      '[e|vai ser|quero|prefiro|pode ser] [para |]retirada',
      '[retirada|retirar|balcao] [|por favor]',
      '[eu|a gente] [busco|busca|pego|pega|retiro|retira] [ai|no balcao|no local]',
      'vou [buscar|pegar|retirar] [ai|no restaurante|no local|]',
      'passo ai [para pegar|para buscar|e pego]',
      'sem entrega eu [pego|busco] [ai|]',
    ],
  },
  {
    nome: 'escolher_pagamento',
    exemplos: [
      '[vou pagar|pago|vai ser|pode ser|quero pagar] [no|em|com] [pix|cartao|dinheiro|debito|credito]',
      '[pix|cartao|dinheiro|no pix|no cartao|no dinheiro|em especie]',
      '[aceita|aceitam] [pix|cartao]? [|entao vai no pix|vou nesse]',
      'pagamento [no|em] [pix|cartao|dinheiro]',
      '[cartao|pix] [esta bom|ta bom|serve|mesmo]',
      'vou [de|no] [pix|cartao|dinheiro] [|mesmo]',
      'preciso de troco para [50|100|cinquenta|cem]',
    ],
  },
  {
    nome: 'finalizar',
    exemplos: [
      '[pode fechar|fecha|fechar|finaliza|finalizar|conclui] [|o pedido|ai|por favor]',
      '[so isso|e isso|era isso|apenas isso] [|mesmo|por enquanto|obrigado]',
      '[pode mandar|manda ver|confirma|confirmar|ta confirmado]',
      'nao quero mais nada [pode fechar|so isso|]',
      '[eh|e] isso [ai|] [pode fechar|fecha|]',
      '[fechou|fechado|feito|combinado] [|pode mandar]',
      'so isso [msm|mesmo] [|valeu]',
      '[encerra|encerrar|conclui|concluir] [o pedido|]',
    ],
  },
  {
    nome: 'pedir_humano',
    exemplos: [
      '[quero|queria|preciso|da para|tem como] falar com [um|uma|o|a|] [atendente|humano|pessoa|gerente|responsavel|funcionario|alguem]',
      '[me passa|chama|transfere para] [um|o|a] [atendente|gerente|humano|responsavel|dono]',
      'tem [algum humano|alguma pessoa|atendente] [ai|disponivel]?',
      '[atendente|humano|gerente] [|por favor|agora]',
      'nao quero falar com [robo|maquina|bot] [|quero gente]',
      '[isso|voce] e [um |]robo?',
      'quero [atendimento humano|falar com gente|uma pessoa de verdade]',
      'para de me mandar [mensagem automatica|resposta pronta] [|quero atendente]',
      'me [liga|liguem] [|por favor|que e mais facil]',
      'ninguem [humano |]vai me [atender|responder]?',
    ],
  },
  {
    nome: 'reclamacao',
    exemplos: [
      '[meu|o] pedido [veio|chegou] [errado|frio|incompleto|faltando coisa|todo amassado]',
      '[veio|chegou] [errado|frio|faltando] [o pedido|a pizza|tudo]',
      '[quero|exijo] [reembolso|estorno|meu dinheiro de volta]',
      'vou [reclamar|denunciar] no [procon|reclame aqui]',
      '[isso e um absurdo|que absurdo|pessimo servico|servico horrivel]',
      'a pizza [veio|chegou] [fria|errada|queimada|crua]',
      '[cade|onde esta|onde ta] meu pedido[| ja passou do horario]?',
      'pedido [atrasado|atrasou] [de novo|mais de uma hora|]',
      '[ontem|semana passada] [veio errado|foi um desastre|chegou frio]',
      'vou falar com [meu advogado|a justica|] [isso e caso de processo|]',
      'to [muito |]insatisfeito [com o servico|com voces|]',
    ],
  },
  {
    nome: 'alergia_restricao',
    exemplos: [
      '[tenho|sou] [alergia|alergico|alergica] [a|ao|de] [lactose|leite|gluten|amendoim|camarao|ovo]',
      '[tenho|minha filha tem|meu filho tem] [alergia|intolerancia] [grave|severa|] [a|de] [lactose|gluten|leite]',
      'sou [intolerante|celiaco|celiaca] [a lactose|ao gluten|]',
      '[passei|passou] mal [com|depois de] [comer|o pedido|a comida]',
      '[tem|corre] risco de [contaminacao cruzada|traco de leite|traco de gluten]?',
      '[nao posso|nao devo] comer [gluten|lactose|leite|queijo por causa de alergia]',
      '[alguma|qual] [pizza|massa|opcao] sem [lactose|gluten|leite]? tenho alergia',
      'se eu comer [leite|gluten] [passo mal|vou parar no hospital|tenho reacao]',
    ],
  },
  {
    nome: 'faq_horario',
    exemplos: [
      '[que horas|qual horario] [abre|fecha|abrem|fecham|funciona|funcionam]?',
      '[estao|esta|vcs estao] [abertos|aberto|funcionando] [|agora|hoje]?',
      '[ate que horas|que horas] [funciona|atende|fica aberto]?',
      'qual o horario [de funcionamento|de voces|]?',
      '[abre|abrem|funciona] [hoje|domingo|segunda|amanha|feriado]?',
      '[ja|ainda] [abriu|fechou|estao abertos]?',
    ],
  },
  {
    nome: 'faq_endereco',
    exemplos: [
      'onde [fica|e|voces ficam|vcs ficam] [o restaurante|a loja|voces]?',
      'qual o endereco [de voces|do restaurante|dai]?',
      '[como|onde] [chego|chegar] [ai|no restaurante]?',
      '[me passa|manda] a localizacao [|por favor]',
      '[voces ficam|fica] [em que rua|em que bairro|aonde]?',
    ],
  },
  {
    nome: 'faq_taxa_entrega',
    exemplos: [
      '[qual|quanto e|quanto custa|quanto fica] [a taxa|o frete|a entrega|a taxa de entrega]?',
      '[tem|cobra|cobram] [taxa|frete] [|de entrega]?',
      'a entrega e [gratis|gratuita|cobrada]?',
      'quanto [voces cobram|cobram|e] [pela|de|para] [entrega|frete] [|{bairro}]?',
      '[entregam|entrega|atendem] [em|no|na|] {bairro}?',
      '[voces entregam|entregam] [ate onde|em qual regiao|aonde]?',
      'qual o valor da [taxa|entrega] [para|pro|] {bairro}?',
    ],
  },
  {
    nome: 'faq_tempo',
    exemplos: [
      '[quanto tempo|em quanto tempo] [demora|leva|chega|fica pronto]?',
      '[demora|leva] [muito|quanto] [para chegar|para ficar pronto|a entrega]?',
      'qual o [tempo|prazo] [de entrega|de espera|medio]?',
      '[chega|fica pronto] em [quanto tempo|quantos minutos]?',
      'se eu pedir agora chega [que horas|quando|em quanto tempo]?',
      '[ta demorando|esta demorando] [quanto|muito] [hoje|]?',
    ],
  },
  {
    nome: 'faq_pagamento_info',
    exemplos: [
      '[quais|que] formas de pagamento [aceitam|voces aceitam|tem]?',
      '[aceita|aceitam] [pix|cartao|dinheiro|vale refeicao|vr|va|alelo|ticket|sodexo]?',
      '[da para|posso|tem como] pagar [no|com] [cartao|pix|dinheiro|vale]?',
      '[pode|da para|posso] [parcelar|dividir] [|no cartao]?',
      'como [posso pagar|funciona o pagamento|pago]?',
      'o pagamento e [na entrega|antecipado|quando]?',
    ],
  },
  {
    nome: 'faq_vegetariano',
    exemplos: [
      '[tem|qual|quais] [opcao|opcoes|pizza|pizzas|prato|pratos] [vegetariana|vegetarianas|vegana|veganas|sem carne]?',
      'sou [vegetariano|vegetariana|vegano|vegana] o que [tem|posso pedir|voces tem]?',
      '[tem|fazem] [alguma coisa|algo|opcao] sem [carne|origem animal]?',
      'o que [tem|voces tem] para [vegetariano|vegano]?',
      '[a margherita|a bruschetta|o pao de alho] [e vegetariana|e vegetariano|tem carne]?',
    ],
  },
  {
    nome: 'faq_tamanho',
    exemplos: [
      '[qual o tamanho|quantos pedacos|quantas fatias] [da pizza|tem a pizza|]?',
      'a pizza [e grande|serve quantas pessoas|da para quantos]?',
      '[serve|da para|alimenta] [quantas pessoas|quantos|uma familia]?',
      'pizza [grande|media|pequena|individual] [tem|voces tem]?',
      '[que tamanho|tamanhos] [tem|voces trabalham|fazem]?',
    ],
  },
  {
    nome: 'faq_promocao',
    exemplos: [
      '[tem|alguma] [promocao|promo|desconto|cupom|oferta] [|hoje|ativa]?',
      '[tem|fazem] [combo|kit|promocao de terca]?',
      '[da para|consegue|tem como] [um desconto|melhorar o preco|fazer mais barato]?',
      'primeira compra tem [desconto|cupom|beneficio]?',
      '[cupom|codigo] de desconto [funciona|tem|aceita]?',
    ],
  },
  {
    nome: 'faq_meia',
    exemplos: [
      '[fazem|tem|da para] [meia a meia|meio a meio|metade metade|dois sabores|2 sabores]?',
      '[pode|posso] [pedir|fazer] [metade|meia] [de cada|{item} e metade {item}]?',
      'pizza [metade {item} metade {item}|dois sabores] [da|pode|fazem]?',
      'como funciona [o meia a meia|pizza de dois sabores]?',
    ],
  },
  {
    nome: 'faq_reserva',
    exemplos: [
      '[da para|posso|tem como|voces fazem] [reservar|reserva] [mesa|]?',
      '[tem|preciso de] [reserva|mesa] para [hoje|sabado|aniversario|8 pessoas|20 pessoas]?',
      'queria [reservar|marcar] [uma mesa|para um grupo|um espaco]',
      '[aceita|aceitam] grupo [grande|de 15 pessoas|para comemoracao]?',
      'da para [comemorar aniversario|fazer festa|levar um grupo] ai?',
    ],
  },
  {
    nome: 'faq_nota',
    exemplos: [
      '[emitem|emite|tem|dao] [nota|nota fiscal|cupom fiscal]?',
      '[preciso|quero] [de nota fiscal|da nota|cnpj na nota]',
      '[qual o|me passa o] cnpj [de voces|da empresa|]?',
      'da para [colocar|por] [o cnpj|meu cpf] na nota?',
    ],
  },
  {
    nome: 'faq_bebida',
    exemplos: [
      '[tem|vendem|trabalham com] [cerveja|chopp|drink|bebida alcoolica|caipirinha]?',
      '[que|quais] bebidas [tem|voces tem|vendem]?',
      'tem [coca|guarana|suco|refrigerante|vinho|agua]?',
      '[o vinho|a taca de vinho] [e qual|de qual uva|quanto custa]?',
    ],
  },
  {
    nome: 'faq_infantil',
    exemplos: [
      '[tem|e bom para] [criancas|espaco kids|area kids|cadeirao|menu infantil]?',
      '[posso|da para] levar [crianca|criancas|meu filho pequeno]?',
      'o ambiente e [tranquilo|adequado|bom] para [criancas|familia]?',
      'tem [porcao|prato] [infantil|para crianca|menor]?',
    ],
  },
  {
    nome: 'faq_estacionamento',
    exemplos: [
      '[tem|possui|voces tem] estacionamento [|proprio|na porta|perto]?',
      'onde [estaciono|posso estacionar|deixo o carro]?',
      '[e facil|da para] estacionar [ai|na regiao|perto]?',
      'tem [vaga|manobrista|valet] [|ai]?',
    ],
  },
  {
    nome: 'faq_pet',
    exemplos: [
      '[aceita|aceitam|pode|posso levar] [pet|cachorro|gato|animal] [|no salao|ai]?',
      '[e|voces sao] pet friendly?',
      'da para [ir|almocar|jantar] com [meu cachorro|meu pet]?',
    ],
  },
  {
    nome: 'faq_wifi',
    exemplos: [
      '[tem|voces tem] [wifi|wi-fi|internet] [|para clientes|ai]?',
      'qual [a senha|o nome] do [wifi|wi-fi]?',
    ],
  },
  {
    nome: 'observacao_ingrediente',
    exemplos: [
      '[sem|tira o|tira a|nao gosto de|pode tirar o|pode tirar a] {ingrediente} [|por favor]',
      '{item} sem {ingrediente} [|por favor|pode ser?]',
      '[da para|pode] [fazer|vir] sem {ingrediente}?',
      '[nao|] gosto de {ingrediente} [tira|pode tirar|vem sem]',
      '[capricha|poe bastante|pouco] {ingrediente} [|por favor]',
      'alguma observacao: sem {ingrediente}',
    ],
  },
  {
    nome: 'confirmar',
    exemplos: [
      '[sim|isso|exato|exatamente|pode ser|claro|com certeza|positivo|uhum|aham|ss]',
      '[sim|isso] [mesmo|ai|por favor]',
      '[pode|manda|confirmo|confirma|fechou|ta certo|esta certo|correto]',
      '[e isso|isso mesmo|perfeito|certinho]',
      '[vai|bora|beleza|blz|ok|okay|show|demorou]',
    ],
  },
  {
    nome: 'negar',
    exemplos: [
      '[nao|nao quero|melhor nao|deixa|deixa para la|esquece]',
      '[nao|negativo] [obrigado|valeu|por enquanto]',
      '[ainda] nao [|obrigado]',
      '[nao precisa|sem necessidade|dispenso]',
      '[errado|nao e isso|ta errado|nao era isso]',
    ],
  },
  {
    nome: 'fora_escopo',
    exemplos: [
      'voces [patrocinam|apoiam] [time|evento|projeto]?',
      '[quantos funcionarios|quem e o dono|desde quando existem]?',
      '[estao contratando|tem vaga de emprego|posso trabalhar ai]?',
      'voces [tem|fazem] [rodizio|buffet|marmita|self service]?',
      '[qual o instagram|tem site|tem aplicativo] [de voces|]?',
      'voces [doam|ajudam] [sobras|instituicao|caridade]?',
      '[posso|da para] [alugar o espaco|fazer evento fechado]?',
      'tem [tomada|espaco para trabalhar|musica ao vivo]?',
      '[que|qual] [oleo|farinha|queijo] voces usam?',
      'a [carne|massa|mussarela] e [artesanal|importada|caseira]?',
    ],
  },
];
