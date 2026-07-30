interface ShareableObject {
  title: string;
  status: string;
  location?: { address?: string } | string | null;
  location_city?: string;
}

// Extrai cidade/bairro do objeto para o texto magnético de compartilhamento
export function extractShareLocation(obj: ShareableObject): string {
  if (obj.location_city) return obj.location_city;
  if (obj.location) {
    try {
      const loc = typeof obj.location === 'string' ? JSON.parse(obj.location) : obj.location;
      if (loc?.address) {
        // Pega apenas a primeira parte do endereço (bairro ou rua)
        const parts = loc.address.split(',');
        return parts[0]?.trim() || '';
      }
    } catch { /* ignora */ }
  }
  return '';
}

// Texto magnético para WhatsApp — soa humano, reforça oportunidade de
// reencontro (nunca urgência artificial ou culpa — ver BACKFINDR_INTELLIGENCE.md 4.2/4.5/4.9)
export function buildWhatsAppShareText(obj: ShareableObject, publicUrl: string): string {
  const location = extractShareLocation(obj);

  if (obj.status === 'protected') {
    return `Colei um QR Code do Backfindr no meu ${obj.title}. Se você encontrar, é só escanear — ele me avisa automaticamente: ${publicUrl}`;
  }

  if (obj.status === 'lost') {
    if (location) {
      return `Gente, perdi meu ${obj.title} perto de ${location}. Cadastrei no Backfindr — se alguém encontrar, o link já identifica o dono: ${publicUrl}`;
    }
    return `Gente, perdi meu ${obj.title}. Cadastrei no Backfindr — se alguém encontrar, o link já identifica o dono: ${publicUrl}`;
  }

  if (obj.status === 'stolen') {
    if (location) {
      return `Roubaram meu ${obj.title} perto de ${location}. Registrei o furto no Backfindr: ${publicUrl}`;
    }
    return `Roubaram meu ${obj.title}. Registrei o furto no Backfindr: ${publicUrl}`;
  }

  // found / returned / default
  return `Encontrei um objeto perdido${location ? ` perto de ${location}` : ''}. Se for seu, acesse: ${publicUrl}`;
}
