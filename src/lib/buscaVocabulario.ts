// VOCABULÁRIO POR FAMÍLIA da busca (ETAPA 1, enxuta). Um lugar só, em dados. Para incluir um termo basta acrescentar uma palavra na família certa;
// nada aqui depende de código. NÃO tente cobrir tudo: só os tipos e os termos mais comuns de marcas/modelos do Brasil.
//
// REGRA: buscar qualquer palavra de uma família acha as ocorrências que contêm OUTRA palavra da MESMA família no título/descrição e também a categoria
// correspondente (ex.: «carro» acha «Chevrolet Spin cinza 2020» e qualquer ocorrência de categoria Veículo). Ordem: palavra exata primeiro; depois
// família/categoria; a nota antiga só desempata. Quem usa: só as consumidoras de BUSCA que pedirem (Feed e /achei, via `amplo=1`). O MATCHING
// (src/lib/matching.ts, dicionário próprio) e os fluxos /flow/* NÃO usam este arquivo.
//
// FORMATO (tudo em minúsculas, SEM acento; plural simples é tratado por quem busca; frases com espaço valem como frase inteira):
//  • termos: equivalentes entre si (qualquer um acha os outros).
//  • grupos: equivalência SÓ dentro de cada grupo (ex.: cachorro≠gato), para a família não ficar larga demais.
//  • guardaChuva: palavra geral que acha TODOS os grupos (ex.: «pet»), e que é achada por qualquer grupo (ex.: «cachorro» acha «pet»).
//  • ambiguos: palavras que NÃO valem sozinhas (gol, up, fit…): só contam se o mesmo texto tiver uma palavra de contexto (marca ou tipo; «placa» NÃO serve: «gol de placa» é futebol).
//  • categorias: valores da coluna `category` do banco (o Feed trata «animal» como «pet»). O reconhecimento por categoria NUNCA vale para legado. Em família com `grupos`
//    só o guarda-chuva (pet, documento, eletronico) pede a categoria inteira; «cachorro» acha pets cachorro (e «pet»), não toda a categoria pet.

export interface Ambiguo { termo: string; comContexto: string[] }
export interface Familia {
  nome: string;
  categorias: string[];
  termos?: string[];
  grupos?: string[][];
  guardaChuva?: string[];
  ambiguos?: Ambiguo[];
}

export const FAMILIAS: Familia[] = [
  {
    nome: 'veiculos', categorias: ['vehicle'],
    termos: [
      // tipos
      'carro', 'automovel', 'veiculo', 'caminhonete', 'picape', 'pickup', 'van', 'caminhao', 'utilitario', 'moto', 'motocicleta', 'scooter',
      // marcas
      'chevrolet', 'fiat', 'volkswagen', 'vw', 'ford', 'honda', 'toyota', 'hyundai', 'yamaha', 'renault', 'jeep', 'nissan', 'kia', 'suzuki', 'peugeot', 'mitsubishi',
      // modelos mais comuns
      'spin', 'civic', 'corolla', 'hb20', 'hilux', 'ranger', 'strada', 's10', 'compass', 'kwid', 'palio', 'saveiro', 'fusca', 'kombi', 'biz', 'pcx', 'cg 150', 'cg 160', 'cg 125',
    ],
    ambiguos: [
      { termo: 'onix', comContexto: ['chevrolet', 'gm', 'carro', 'automovel', 'veiculo'] },           // «ônix» também é pedra
      { termo: 'gol', comContexto: ['volkswagen', 'vw', 'carro', 'automovel', 'veiculo'] },           // gol de futebol
      { termo: 'uno', comContexto: ['fiat', 'carro', 'automovel', 'veiculo'] },
      { termo: 'up', comContexto: ['volkswagen', 'vw', 'carro', 'automovel', 'veiculo'] },
      { termo: 'fit', comContexto: ['honda', 'carro', 'automovel', 'veiculo'] },
      { termo: 'ka', comContexto: ['ford', 'carro', 'automovel', 'veiculo'] },
      { termo: 'polo', comContexto: ['volkswagen', 'vw', 'carro', 'automovel', 'veiculo'] },         // camisa polo
      { termo: 'cg', comContexto: ['honda', 'moto', 'motocicleta'] },
      { termo: 'pop', comContexto: ['honda', 'moto', 'motocicleta'] },
      { termo: 'fan', comContexto: ['honda', 'moto', 'motocicleta'] },
      { termo: 'tracker', comContexto: ['chevrolet', 'carro', 'automovel', 'veiculo'] },             // rastreador GPS
      { termo: 'creta', comContexto: ['hyundai', 'carro', 'automovel', 'veiculo'] },
    ],
  },
  { nome: 'bicicletas', categorias: ['bike'], termos: ['bicicleta', 'bike', 'bici', 'bmx', 'mtb', 'caloi', 'monark', 'oggi', 'trek', 'specialized'], guardaChuva: ['veiculo'] },
  {
    nome: 'documentos', categorias: ['document'],
    grupos: [['rg', 'identidade', 'carteira de identidade'], ['cnh', 'habilitacao', 'carteira de motorista'], ['cpf'], ['passaporte']],
    guardaChuva: ['documento'],
  },
  {
    nome: 'celulares', categorias: ['phone'],
    termos: ['celular', 'telefone', 'smartphone', 'iphone', 'samsung', 'galaxy', 'motorola', 'xiaomi', 'redmi', 'android'],
  },
  {
    nome: 'eletronicos', categorias: ['electronics'],
    grupos: [['notebook', 'laptop', 'macbook', 'computador'], ['tablet', 'ipad', 'kindle'], ['fone', 'headphone', 'airpod', 'earphone', 'headset']],
    guardaChuva: ['eletronico'],
  },
  {
    nome: 'pets', categorias: ['pet', 'animal'],
    grupos: [
      ['cachorro', 'cachorra', 'cadela', 'cao', 'dog', 'cachorrinho', 'poodle', 'labrador', 'golden', 'pitbull', 'bulldog', 'husky', 'pug', 'yorkshire', 'vira-lata', 'viralata'],
      ['gato', 'gata', 'gatinho', 'felino', 'cat', 'siames', 'persa'],
      ['passaro', 'papagaio', 'calopsita', 'periquito', 'cacatua', 'canario'],
    ],
    guardaChuva: ['pet', 'animal', 'bicho'],
  },
  { nome: 'bolsas', categorias: ['bag'], termos: ['bolsa', 'mochila', 'mala', 'sacola', 'pochete', 'maleta', 'bagagem', 'valise'] },
  { nome: 'carteiras', categorias: ['wallet'], termos: ['carteira', 'wallet', 'porta documentos', 'porta-documentos', 'porta cartoes'] },
  { nome: 'chaves', categorias: ['keys'], termos: ['chave', 'chaveiro', 'key'] },
  { nome: 'joias', categorias: ['jewelry'], termos: ['joia', 'anel', 'alianca', 'colar', 'brinco', 'pulseira', 'corrente', 'pingente'] },
  { nome: 'relogios', categorias: ['jewelry', 'other'], termos: ['relogio', 'smartwatch', 'rolex', 'casio', 'seiko', 'apple watch'] },
];

/** Palavras que ficaram FORA de propósito (não valem nem como contexto), com o motivo. Documentação + teste: não entram no vocabulário. */
export const FORA_DO_VOCABULARIO: Array<{ termo: string; motivo: string }> = [
  { termo: 'sol', motivo: '«óculos de sol», «sol» (o astro), «Sol» (nome); já existe no dicionário antigo de «oculos»' },
  { termo: 'auto', motivo: '«auto escola», «auto de infração»…; «automovel» já cobre' },
  { termo: 'fazer', motivo: 'Yamaha Fazer, mas é o verbo «fazer»' },
  { termo: 'city', motivo: 'Honda City, mas «city» aparece em nomes de lugar e de loja' },
  { termo: 'titan', motivo: 'Honda Titan, mas também nome de pessoa/marca/animal' },
  { termo: 'argo', motivo: 'Fiat Argo, mas também nome próprio (e de pets)' },
  { termo: 'mobi', motivo: 'Fiat Mobi, mas «mobi» aparece em outros contextos' },
  { termo: 'molho', motivo: '«molho de chaves», mas «molho» é o tempero' },
  { termo: 'controle', motivo: 'controle de portão/garagem, mas também controle de TV/videogame' },
  { termo: 'filhote', motivo: 'serve a cachorro, gato e outros: não distingue a família' },
  { termo: 'aparelho', motivo: 'celular, mas também dentário, de som…' },
  { termo: 'apple', motivo: 'celular/relógio/notebook ou fruta' },
  { termo: 'lg', motivo: 'duas letras; marca de celular e de TV' },
  { termo: 'ouro', motivo: 'joia, mas também cor, material, «Ouro Preto»' },
  { termo: 'prata', motivo: 'cor/material/nome próprio' },
  { termo: 'pc', motivo: 'duas letras; computador, mas também sigla' },
];
