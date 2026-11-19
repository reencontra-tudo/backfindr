// O antigo /buscar foi desligado (decisão do Marcos): a busca por texto agora fica no Feed, sem cadastro, em perdidos, achados e roubados.
// Redirecionamento PERMANENTE (308) para /feed, preservando o texto: /buscar?q=oculos → /feed?q=oculos (o Feed abre a busca já preenchida).
// Também aceita ?keyword= (links de e-mails antigos). O resto (status, categoria…) não é repassado.
import { permanentRedirect } from 'next/navigation';
import { normalizarConsulta } from '@/lib/feed/consulta';

export default function BuscarPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const bruto = searchParams.q ?? searchParams.keyword;
  const q = normalizarConsulta(Array.isArray(bruto) ? bruto[0] : bruto);
  permanentRedirect(q ? `/feed?q=${encodeURIComponent(q)}` : '/feed');
}
