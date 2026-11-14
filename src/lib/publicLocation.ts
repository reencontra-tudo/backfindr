// Endereço nas saídas PÚBLICAS (API pública, leitura por código, página do objeto e telas que usam a lista pública): só «bairro, cidade - UF»,
// a mesma redução do Feed (parseLocation). Vale só para cadastros de USUÁRIO: legado e sinais públicos saem exatamente como estão.
// O texto original continua no banco e é o que o casamento/pontuação/busca usam; o dono vê o endereço completo nas telas dele (outras rotas).
import { parseLocation, NO_LOCATION_LABEL } from '@/lib/feed/location';
import { maskPersonNames } from '@/lib/privacy/maskPersonNames';

export interface OrigemDoObjeto { is_legacy?: boolean | null; source?: string | null }

/** true = cadastro de usuário (a redução vale); false = legado ou sinal público (sai como está). */
export const ehCadastroDeUsuario = (o: OrigemDoObjeto): boolean => o.is_legacy !== true && o.source !== 'public_signal';

/** Endereço para a saída pública. Sem logradouro/CEP no resultado: «bairro, cidade - UF». Sem bairro nem cidade: undefined (a tela já omite). */
export function enderecoPublico(address: string | null | undefined, origem: OrigemDoObjeto): string | undefined {
  if (typeof address !== 'string' || address.trim() === '') return address ?? undefined;
  if (!ehCadastroDeUsuario(origem)) return address;
  const label = parseLocation(address).label;
  if (label === NO_LOCATION_LABEL) return undefined;
  return maskPersonNames(label) || undefined;
}

/** Aplica a redução ao objeto `location` ({lat, lng, address}) sem mexer nas coordenadas. */
export function localizacaoPublica<T extends { address?: string | null } | null | undefined>(loc: T, origem: OrigemDoObjeto): T {
  if (!loc || typeof loc !== 'object' || !ehCadastroDeUsuario(origem)) return loc;
  const reduzido = enderecoPublico(typeof loc.address === 'string' ? loc.address : undefined, origem);
  return { ...loc, address: reduzido } as T;
}
