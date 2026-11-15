// Voltar à página pretendida depois do login ou do cadastro (ex.: quem escaneia um QR e precisa entrar para avisar).
// SEGURANÇA: só caminhos do próprio site, de uma lista curta (/objeto/<código>, /scan/<código>, /dashboard/mensagens[/<id>]);
// qualquer outra coisa (endereço externo, //, \\, javascript:, caminho fora da lista) é ignorada e o login segue como sempre.
const CODIGO = '[A-Za-z0-9_-]{4,64}';
const PERMITIDOS = [
  new RegExp(`^/objeto/${CODIGO}$`),
  new RegExp(`^/scan/${CODIGO}$`),
  /^\/dashboard\/mensagens(\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?$/,
];
const CHAVE = 'bf_next';

export function proximaPaginaSegura(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null;
  const t = bruto.trim();
  if (t.length === 0 || t.length > 200) return null;
  if (!t.startsWith('/') || t.startsWith('//') || t.includes('\\') || /[\u0000-\u001f\u007f]/.test(t)) return null;
  const semAviso = t.endsWith('?aviso=1') ? t.slice(0, -'?aviso=1'.length) : t;   // único parâmetro aceito
  if (semAviso.includes('?') || semAviso.includes('#') || semAviso.includes('%')) return null;
  return PERMITIDOS.some((re) => re.test(semAviso)) ? t : null;
}

/** Guarda o destino (já validado) na aba, para sobreviver ao desvio por Google ou link mágico na mesma aba. */
export function guardarProximaPagina(bruto: unknown): void {
  const ok = proximaPaginaSegura(bruto);
  try { if (ok) sessionStorage.setItem(CHAVE, ok); } catch { /* sem armazenamento: segue sem voltar */ }
}

/** Lê e apaga o destino guardado; devolve null se não houver ou se não for seguro. */
export function consumirProximaPagina(): string | null {
  try {
    const v = sessionStorage.getItem(CHAVE); sessionStorage.removeItem(CHAVE);
    return proximaPaginaSegura(v);
  } catch { return null; }
}
