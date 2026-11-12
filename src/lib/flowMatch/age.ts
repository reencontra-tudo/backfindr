// Idade amigável do card do passo 2 (usa created_at, como sempre): minutos/horas como antes;
// «há N dias» até 30 dias; «há N meses» até 12 meses; «há mais de N anos» a partir de 1 ano.
export function formatAge(dateStr?: string | null, now: number = Date.now()): string {
  if (!dateStr) return '';
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  if (dias <= 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  if (dias < 365) { const meses = Math.max(1, Math.floor(dias / 30)); return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`; }
  const anos = Math.floor(dias / 365);
  return `há mais de ${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}
