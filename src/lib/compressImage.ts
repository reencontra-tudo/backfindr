/**
 * Comprime uma imagem client-side usando Canvas API.
 * Redimensiona para no máximo `maxWidth` px e aplica qualidade JPEG.
 * Retorna um File com o mesmo nome, pronto para envio via FormData.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.82,
): Promise<File> {
  // Se não for imagem ou for GIF/SVG, retorna original
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calcular dimensões mantendo proporção
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // fallback: retorna original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          // Só usa a versão comprimida se for menor que o original
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed.size < file.size ? compressed : file);
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback: retorna original
    };

    img.src = url;
  });
}

/**
 * Comprime múltiplas imagens em paralelo.
 */
export async function compressImages(
  files: File[],
  maxWidth = 1200,
  quality = 0.82,
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, maxWidth, quality)));
}
