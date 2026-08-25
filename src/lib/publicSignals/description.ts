// ─── Geração da description pública de objetos criados via Public Signals ───
//
// Por que NÃO usar extracted_fields.raw_description aqui (decisão deliberada,
// não descuido): amostragem de produção em 25/08/2026 mostrou que a
// qualidade desse campo é bimodal e as duas variantes são perigosas de
// publicar verbatim:
//   - fontes 'institution' (ex: cgn.inf.br) têm prosa limpa, mas às vezes
//     embutem o PRÓPRIO contato do achador (telefone) no meio do texto —
//     exatamente o dado que extract.ts já separa deliberadamente em
//     has_contact_data/contact_text para não vazar em campos públicos.
//     Copiar raw_description verbatim reintroduziria esse vazamento.
//   - fontes 'press_rss' (Google News) às vezes têm raw_description como
//     fragmento de HTML cru (ex: `<a href="...base64 enorme...">texto
//     cortado no meio`), inutilizável como texto público.
// Por isso a description é montada só a partir de campos já estruturados e
// validados pela extração (title/category/location_text) — o mesmo
// SYSTEM_PROMPT de extract.ts já proíbe explicitamente incluir telefone/
// e-mail/endereço em qualquer campo além de contact_text, então esses três
// campos são seguros de publicar como estão.
const CATEGORY_LABELS_PT: Record<string, string> = {
  phone: 'celular', wallet: 'carteira', keys: 'chaves', bag: 'bolsa/mochila',
  pet: 'pet', bike: 'bicicleta', vehicle: 'veículo', document: 'documento',
  jewelry: 'joia', electronics: 'eletrônico', clothing: 'roupa/peça', other: 'objeto',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  press_rss: 'imprensa/notícia local',
  institution: 'canal institucional de achados e perdidos',
  google_alert_corroboration: 'alerta público',
  manual_other: 'fonte pública',
};

export interface DescriptionFields {
  title?: string | null;
  category?: string | null;
  location_text?: string | null;
}

export function buildPublicSignalDescription(
  fields: DescriptionFields,
  sourceUrl: string,
  sourceType?: string | null
): string {
  const catLabel = CATEGORY_LABELS_PT[fields.category ?? ''] ?? 'objeto';
  const srcLabel = SOURCE_TYPE_LABELS[sourceType ?? ''] ?? 'fonte pública';
  const titlePart = fields.title?.trim() ? `${fields.title.trim()}. ` : '';
  const locationPart = fields.location_text?.trim() ? ` Local: ${fields.location_text.trim()}.` : '';
  return `${titlePart}Categoria: ${catLabel}.${locationPart} Ocorrência identificada automaticamente a partir de ${srcLabel}. Fonte: ${sourceUrl}`;
}

// Prefixo exato usado pelo bug legado (todo objeto tinha a MESMA description,
// só variando a URL no fim) — usado pelo backfill pra identificar quais
// objects ainda precisam de correção. Ver
// src/app/api/v1/admin/fix-legacy-public-signal-descriptions/route.ts.
export const LEGACY_GENERIC_DESCRIPTION_PREFIX =
  'Ocorrência identificada automaticamente a partir de fonte pública. Fonte:';
