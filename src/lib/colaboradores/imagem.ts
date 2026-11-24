// Imagem da página do colaborador (E5): limites e conferência do tipo pelos primeiros bytes. Funções puras.
export const LIMITE_IMAGEM_BYTES = 2 * 1024 * 1024;

/** Confere o tipo pelos primeiros bytes (não confia no que o navegador disse). */
export function tipoDaImagem(b: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

