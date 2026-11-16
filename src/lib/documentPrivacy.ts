// Documento de USUÁRIO («perdi»/«achei» com categoria documento): o nome do titular é público por escolha do dono,
// mas o NÚMERO do documento nunca é guardado nem mostrado inteiro: só os 4 últimos dígitos.
//
// Estas funções valem SÓ para cadastro de usuário na categoria documento. Sinal público e legado NÃO passam por aqui
// (sinal público segue com a máscara de nome em objectPublicView.ts; legado não é tocado).

export const DOCUMENT_TYPES = ['rg', 'cpf', 'passport', 'drivers_license', 'work_card', 'student_id', 'other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Rótulo em português do tipo de documento (para telas). */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  rg: 'RG',
  cpf: 'CPF',
  passport: 'Passaporte',
  drivers_license: 'Carteira de Motorista',
  work_card: 'Carteira de Trabalho',
  student_id: 'Carteirinha de Estudante',
  other: 'Outro',
};

/**
 * Últimos 4 dígitos. Aceita qualquer texto: tira tudo que não é dígito e, se sobrar mais de 4, FICA SÓ COM OS 4 ÚLTIMOS
 * (o número inteiro nunca passa daqui). Sem dígitos: null.
 */
export function ultimos4Digitos(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(-4);
}

/** Tipo de documento válido ou null. */
export function tipoDeDocumento(value: unknown): DocumentType | null {
  return typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value) ? (value as DocumentType) : null;
}

// Sequência de 6 ou mais dígitos, com no máximo UM separador (espaço, ponto, hífen ou barra) entre os dígitos:
// «12345678900», «123.456.789-00», «12 345 678», «12.345.678-9».
const SEQUENCIA_LONGA = /\d(?:[ .\-/]?\d){5,}/g;
const DATA = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/; // 15/03/2030, 15-03-30
const CEP = /^\d{5}-\d{3}$/; // 01310-100

/**
 * Texto livre de documento (título, descrição, nome): toda sequência de 6+ dígitos vira «***» + 4 últimos dígitos.
 * Não mexe em números curtos (até 5 dígitos), em datas (15/03/2030) nem em CEP (01310-100). Telefones e outros números longos SÃO mascarados.
 */
export function mascararDigitosLongos(text: string): string {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(SEQUENCIA_LONGA, (m) => {
    if (DATA.test(m) || CEP.test(m)) return m;
    const digits = m.replace(/\D/g, '');
    return `***${digits.slice(-4)}`;
  });
}

/** Nome do titular: sem caracteres de controle, espaços simples, no máximo 100 caracteres, dígitos longos mascarados. Vazio: null. */
export function nomeDoTitular(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const limpo = mascararDigitosLongos(value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 100).trim();
  return limpo || null;
}

/**
 * Entrada de documento de usuário (POST/PATCH): devolve só o que pode ser guardado.
 * `document_number` (formato antigo) nunca é guardado: vira só os 4 últimos dígitos.
 */
export function camposDeDocumento(body: Record<string, unknown>): {
  subjectName: string | null;
  documentType: DocumentType | null;
  last4: string | null;
  temNome: boolean; temTipo: boolean; temFinal: boolean;
} {
  const temNome = 'document_owner_name' in body;
  const temTipo = 'document_type' in body;
  const temFinal = 'document_last4' in body || 'document_number' in body;
  return {
    subjectName: nomeDoTitular(body.document_owner_name),
    documentType: tipoDeDocumento(body.document_type),
    last4: ultimos4Digitos('document_last4' in body ? body.document_last4 : body.document_number),
    temNome, temTipo, temFinal,
  };
}

/** Chaves que nunca vão para category_fields de documento (vão para colunas próprias ou não são guardadas). */
export const CHAVES_DE_DOCUMENTO = ['document_owner_name', 'document_type', 'document_number', 'document_last4'] as const;

/**
 * Quando o titular e o final do documento SAEM em público: lista de PERMISSÃO (só perdido e roubado).
 * Qualquer outro status («found», «returned», «protected», «archived» ou um valor novo) NÃO mostra. Nunca trocar por lista de bloqueio.
 * Em «encontrei» (status «found») o nome inteiro de um terceiro não se mostra, e o servidor também não grava o que chegar.
 */
export const STATUS_QUE_MOSTRAM_TITULAR = ['lost', 'stolen'] as const;
export function statusMostraTitular(status: unknown): boolean {
  return typeof status === 'string' && (STATUS_QUE_MOSTRAM_TITULAR as readonly string[]).includes(status);
}

/** Em «encontrei» o formulário não pede titular nem final, e o servidor ignora os dois. */
export function statusIgnoraTitular(status: unknown): boolean {
  return status === 'found';
}
