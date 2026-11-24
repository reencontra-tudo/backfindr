// PR B (decisão MC-02, 24/11/2026): EXIBIR os campos específicos das categorias, com rótulos em português e com a regra de privacidade num lugar só.
//
// SENSÍVEIS (só o TITULAR vê: nunca em página pública, cartaz, Feed, SEO, JSON-LD nem e-mail para terceiros): IMEI, número de série, chassi, microchip,
// brinco/registro e conteúdo da carteira. (+ número do motor do veículo: mesma natureza do chassi; proposta a confirmar no PR.)
// PÚBLICOS: todos os demais campos não sensíveis (marca, modelo, cor, tipo, raça, porte, marcas e sinais…) e a PLACA do veículo ROUBADO (exceção decidida
// pelo fundador: é como as pessoas reconhecem o carro). Placa de veículo perdido/encontrado/protegido: só o titular.
// Só os campos da CONFIGURAÇÃO (`config/categoryFields.ts`) são exibidos: qualquer outra chave em `category_fields` (coordenadas e os dados do documento) nunca sai daqui.
import { getAllFieldsForCategory, getCategoryFieldConfig, type FieldDefinition } from '@/config/categoryFields';

/** Campos que só o titular vê. */
export const CAMPOS_SENSIVEIS: ReadonlySet<string> = new Set([
  'phone_imei', 'phone_serial',                 // celular: IMEI e número de série
  'electronics_imei', 'electronics_serial',     // eletrônico: IMEI e número de série
  'vehicle_vin', 'vehicle_engine',              // veículo: chassi e número do motor
  'bike_serial',                                // bicicleta: número de série
  'pet_microchip',                              // pet: microchip
  'animal_id_tag',                              // animal: brinco, microchip ou registro
  'wallet_contents',                            // carteira: conteúdo
]);

/** Campos de TEXTO LIVRE que aparecem em página pública: levam o aviso de que o texto é público (decisão do fundador, 24/11/2026; mesmo texto no cadastro e na edição). */
export const CAMPOS_TEXTO_LIVRE_PUBLICO: ReadonlySet<string> = new Set([
  'electronics_specs',                                                      // eletrônico: especificações técnicas
  'wallet_distinguishing_marks', 'keys_description', 'keys_distinguishing_marks', 'bike_distinguishing_marks',
  'pet_distinguishing_marks', 'pet_collar_description', 'animal_marks',     // marcas e sinais, descrição das chaves e da coleira
]);
export const AVISO_TEXTO_PUBLICO = 'Este texto é público. Não escreva aqui IMEI, número de série, chassi, documentos ou dados pessoais — eles têm campo próprio protegido.';

/** Placa: pública só quando o veículo é ROUBADO. */
export const CAMPO_PLACA = 'vehicle_plate';
export const STATUS_PLACA_PUBLICA = 'stolen';

export interface CampoExibido { chave: string; rotulo: string; valor: string; sensivel: boolean }

/** Texto legível do valor: select → rótulo da opção («dog» vira «Cachorro»); texto/número como estão (aparados). Vazio → null. */
export function valorLegivel(def: FieldDefinition, bruto: unknown): string | null {
  const texto = typeof bruto === 'number' && Number.isFinite(bruto) ? String(bruto) : typeof bruto === 'string' ? bruto.trim() : '';
  if (!texto) return null;
  if (def.type === 'select' && def.options) return def.options.find((o) => o.value === texto)?.label ?? texto;
  return texto;
}

/** O campo pode aparecer em PÁGINA PÚBLICA para um objeto neste status? */
export function campoEhPublico(chave: string, status: string | null | undefined): boolean {
  if (chave === CAMPO_PLACA) return status === STATUS_PLACA_PUBLICA;
  return !CAMPOS_SENSIVEIS.has(chave);
}

/**
 * Campos específicos para exibir, na ordem da configuração. `publico: true` aplica a regra de privacidade (sem sensíveis; placa só de veículo roubado);
 * `publico: false` é a visão do TITULAR (todos, com a marca de sensível). Documento e categorias sem configuração: lista vazia (o documento tem regras próprias).
 */
export function camposParaExibir(
  categoria: string | null | undefined,
  categoryFields: Record<string, unknown> | null | undefined,
  opcoes: { publico: boolean; status?: string | null },
): CampoExibido[] {
  if (!categoria || categoria === 'document' || !categoryFields || typeof categoryFields !== 'object') return [];
  const cfg = getCategoryFieldConfig(categoria);
  if (!cfg) return [];
  const out: CampoExibido[] = [];
  for (const def of [...cfg.essentialFields, ...cfg.optionalFields]) {
    if (opcoes.publico && !campoEhPublico(def.name, opcoes.status)) continue;
    const valor = valorLegivel(def, categoryFields[def.name]);
    if (valor !== null) out.push({ chave: def.name, rotulo: def.label, valor, sensivel: CAMPOS_SENSIVEIS.has(def.name) });
  }
  return out;
}

/** Valores BRUTOS dos campos da configuração da categoria (para preencher o formulário de edição do titular). Só chaves conhecidas. */
export function valoresBrutosDoTitular(categoria: string | null | undefined, categoryFields: Record<string, unknown> | null | undefined): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!categoria || categoria === 'document' || !categoryFields) return out;
  const cfg = getCategoryFieldConfig(categoria);
  if (!cfg) return out;
  for (const def of [...cfg.essentialFields, ...cfg.optionalFields]) {
    const v = categoryFields[def.name];
    if (typeof v === 'string' && v.trim()) out[def.name] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[def.name] = v;
  }
  return out;
}

/**
 * Validação da EDIÇÃO feita pelo titular: só nomes da configuração da categoria; texto aparado e limitado ao `maxLength` do campo (padrão 300);
 * número inteiro para campo numérico. Valor vazio = remover o campo. Qualquer outra chave é descartada. Devolve o que vai ser gravado e o que será removido.
 */
export function validarEdicaoDeCampos(categoria: string | null | undefined, corpo: unknown): { gravar: Record<string, string | number>; remover: string[] } {
  const gravar: Record<string, string | number> = {};
  const remover: string[] = [];
  if (!categoria || categoria === 'document' || !corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return { gravar, remover };
  const cfg = getCategoryFieldConfig(categoria);
  if (!cfg) return { gravar, remover };
  const recebido = corpo as Record<string, unknown>;
  for (const def of [...cfg.essentialFields, ...cfg.optionalFields]) {
    if (!(def.name in recebido)) continue;
    const v = recebido[def.name];
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) { remover.push(def.name); continue; }
    if (def.type === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (Number.isInteger(n) && n >= 0 && n <= 999999) gravar[def.name] = n;
      continue;
    }
    if (typeof v !== 'string') continue;
    const t = v.trim().slice(0, def.maxLength ?? 300);
    if (def.type === 'select' && def.options && !def.options.some((o) => o.value === t)) continue; // opção que não existe: ignora
    gravar[def.name] = t;
  }
  return { gravar, remover };
}

/** Campos específicos que o titular MUDOU na edição, em relação ao que estava salvo (texto aparado; vazio = remover). Nada mudou ou categoria sem campos: undefined (o corpo do pedido fica idêntico ao de antes). */
export function camposAlterados(categoria: string, atuais: Record<string, unknown>, originais: Record<string, unknown>): Record<string, string> | undefined {
  if (categoria === 'document' || !getCategoryFieldConfig(categoria)) return undefined;
  const norm = (v: unknown) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '');
  const out: Record<string, string> = {};
  for (const f of getAllFieldsForCategory(categoria)) {
    if (norm(atuais[f.name]) !== norm(originais[f.name])) out[f.name] = norm(atuais[f.name]);
  }
  return Object.keys(out).length ? out : undefined;
}

