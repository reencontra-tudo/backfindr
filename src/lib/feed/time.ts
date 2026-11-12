// Tempo relativo calculado da data REAL de cadastro. Nunca sugere urgência nem atividade ao vivo
// («agora», «há instantes»): a menor unidade é «há menos de 1 hora».
export function relativeTimeLabel(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, now - t);
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'há menos de 1 hora';
  if (hours < 24) return `há ${hours} hora${hours > 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dia${days > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(days / 365);
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
}

export const STATUS_LABELS: Record<string, string> = { lost: 'Perdido', found: 'Achado', stolen: 'Roubado' };
