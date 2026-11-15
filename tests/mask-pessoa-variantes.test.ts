// Máscara de nome de pessoa (maskPersonNames): variações realistas, sem falso positivo em títulos comuns. Nomes inventados.
import { describe, expect, it } from 'vitest';
import { maskPersonNames, MASK_PLACEHOLDER } from '@/lib/privacy/maskPersonNames';

const M = MASK_PLACEHOLDER;
describe('mascara o nome', () => {
  const casos: [string, string][] = [
    ['Documento encontrado em nome de Maria da Silva Santos', `Documento encontrado em nome de ${M}`],
    ['DOCUMENTO EM NOME DE JOÃO PEREIRA LIMA', `DOCUMENTO EM NOME DE ${M}`],
    ['documento em nome da fulana de tal', `documento em nome da ${M}`],
    ['RG em nome do Sr. João Pereira, encontrado no centro', `RG em nome do ${M}, encontrado no centro`],
    ['CNH em nome da Sra. Ana de Souza. Entregue na delegacia', `CNH em nome da ${M}. Entregue na delegacia`],       // «Sra.» não encerra o nome
    ['Passaporte em nome do Dr. Carlos Alberto Dias; contato na delegacia', `Passaporte em nome do ${M}; contato na delegacia`],
    ['Documentos pertencentes à Joana Dias', `Documentos pertencentes à ${M}`],
    ['Documentos de propriedade do José Alves dos Santos', `Documentos de propriedade do ${M}`],
    ['Titular: Pedro Henrique Gomes', `Titular: ${M}`],
    ['Proprietária: Luísa Mendes', `Proprietária: ${M}`],
    ['CNH de Carlos Alberto Souza encontrada', `CNH de ${M} encontrada`],
    ['RG de MARIA SOUZA LIMA encontrado', `RG de ${M} encontrado`],                                                  // nome em maiúsculas
    ['CNH DE JOSÉ DOS SANTOS ACHADA', `CNH DE ${M}`],                                                       // tudo em maiúsculas: não dá para separar o nome do resto; mascarar a mais não expõe ninguém
    ['Habilitação de Pedro dos Santos Filho', `Habilitação de ${M}`],
    ['Documento do Sr. Antônio Carlos', `Documento do Sr. ${M}`],
    ['Pasta com documentos de Beatriz Oliveira e Carlos Dias', `Pasta com documentos de ${M}`],                      // dois nomes ligados por «e»
    ['em nome de J. P. Silva Jr. e outros itens', `em nome de ${M}`],
    ['Document found under the name of John Smith', `Document found under the name of ${M}`],                       // inglês
    ['Passport belongs to John Smith', `Passport belongs to ${M}`],
    ['ID card in the name of Mary Jane Doe', `ID card in the name of ${M}`],
    ['Owner: John Smith', `Owner: ${M}`],
    ['Cartão de crédito em nome de Fulano de Tal; contato 11 99999-0000', `Cartão de crédito em nome de ${M}; contato 11 99999-0000`],
  ];
  for (const [entrada, saida] of casos) it(JSON.stringify(entrada), () => { const r = maskPersonNames(entrada); expect(r).toBe(saida); expect(maskPersonNames(r)).toBe(r); });   // idempotente
});

describe('não mascara títulos comuns (sem falso positivo)', () => {
  const comuns = ['Carteira de trabalho encontrada', 'Carteira de Trabalho Digital encontrada', 'CARTEIRA DE TRABALHO DIGITAL ENCONTRADA', 'Documento de identidade encontrado', 'Documento de veículo encontrado',
    'Carteira de motorista encontrada', 'Cartão de crédito encontrado', 'Cartão de estacionamento achado', 'Passaporte encontrado na rua', 'RG encontrado no ônibus', 'CNH achada perto do mercado',
    'Chaves do carro encontradas', 'Cachorro perdido no bairro Centro', 'Mochila vermelha achada', 'Documentos encontrados na praça', 'Certidão de nascimento encontrada', 'Título de eleitor encontrado',
    'Document found near the bus station', 'Wallet with documents found', '', 'Carteira de Estudante encontrada', 'Documento de Habilitação encontrado'];
  for (const t of comuns) it(JSON.stringify(t), () => expect(maskPersonNames(t)).toBe(t));
});

describe('o que ainda escapa (registrado, não é regra segura): nome sozinho, sem sobrenome, ou depois de traço', () => {
  it('«RG de Maria» e «RG - João Pereira» não são mascarados (mascarar títulos assim pegaria texto comum)', () => {
    expect(maskPersonNames('RG de Maria encontrado')).toBe('RG de Maria encontrado');
    expect(maskPersonNames('CPF e RG - João Pereira Lima encontrados')).toBe('CPF e RG - João Pereira Lima encontrados');
  });
});
