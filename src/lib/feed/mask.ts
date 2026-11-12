// Máscara de nome de pessoa para o Feed (roda SEMPRE no servidor, antes de responder e antes de gerar o HTML).
//
// Motivo: sinais públicos vindos da imprensa/canais institucionais trazem títulos como
// «Documento encontrado em nome de <nome completo>». O Google lê o HTML (e o JSON embutido na página),
// então o nome não pode chegar ao navegador nem no HTML. Só o trecho do nome é trocado.
//
// Estratégia: padrões de "titularidade" (em nome de, pertencente a, de propriedade de, titular:) e
// «documento/RG/CNH/… de <Nome Sobrenome>». Na dúvida, mascara a mais (mascarar demais não expõe ninguém).
export const MASK_PLACEHOLDER = '(nome omitido)';

// Cauda do nome: vai até vírgula, ponto e vírgula, quebra de linha ou ponto final de frase.
// Pontos depois de 1–2 letras (iniciais, «Jr.») não encerram o nome.
const TAIL = String.raw`(?:\b\p{L}{1,2}\.|[^.;,\n])+`;

const OWNERSHIP: RegExp[] = [
  new RegExp(String.raw`(\bem\s+nome\s+(?:de|da|do|dos|das)\s+)${TAIL}`, 'giu'),
  new RegExp(String.raw`(\bpertencentes?\s+(?:a|ao|à|aos|às)\s+)${TAIL}`, 'giu'),
  new RegExp(String.raw`(\bde\s+propriedade\s+(?:de|da|do)\s+)${TAIL}`, 'giu'),
  new RegExp(String.raw`(\b(?:titular|propriet[aá]ri[oa])\s*:\s*)${TAIL}`, 'giu'),
];

// «documento de Maria Souza», «CNH do João Pereira Lima» (duas ou mais palavras capitalizadas)
const DOC_OF = new RegExp(
  String.raw`(\b(?:[Dd]ocumentos?|RG|Rg|rg|CNH|Cnh|cnh|CPF|Cpf|cpf|[Cc]art[aã]o|[Pp]assaporte|[Ii]dentidade|[Hh]abilita[cç][aã]o)\s+(?:de|da|do)\s+)` +
  String.raw`(\p{Lu}\p{Ll}+(?:\s+(?:d[aeo]s?|e))?(?:\s+\p{Lu}\p{Ll}+)+(?:\s+(?:d[aeo]s?|e)\s+\p{Lu}\p{Ll}+)*)`,
  'gu',
);
// Palavras que, depois de «documento de», não são nome de pessoa («Carteira de Trabalho Digital»)
const NOT_A_NAME = new Set([
  'trabalho', 'identidade', 'credito', 'debito', 'motorista', 'eleitor', 'nascimento', 'casamento',
  'estudante', 'habilitacao', 'veiculo', 'pessoa', 'transito', 'registro', 'reservista', 'saude',
  'vacinacao', 'identificacao', 'banco', 'seguro', 'estacionamento',
]);
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function maskPersonNames(text: string | null | undefined): string {
  if (!text) return '';
  let out = String(text);
  for (const re of OWNERSHIP) out = out.replace(re, (_m, lead: string) => `${lead}${MASK_PLACEHOLDER}`);
  out = out.replace(DOC_OF, (m, lead: string, name: string) =>
    NOT_A_NAME.has(strip(name.split(/\s+/)[0])) ? m : `${lead}${MASK_PLACEHOLDER}`);
  return out;
}
