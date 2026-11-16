export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { rodarVigia } from '@/lib/vigiaRotinas';

// GET /api/v1/cron/vigia-rotinas — chamado pelo workflow do GitHub Actions a cada 30 minutos (.github/workflows/vigia-rotinas.yml).
// Confere a idade da última marca de vida de cada rotina agendada e avisa os administradores (sino, push e e-mail).
//
// Segredo PRÓPRIO (VIGIA_SECRET), separado do CRON_SECRET e do SIGNALS_CRON_SECRET: assim ele pode ser trocado sem afetar as rotinas.
// Fail-closed: sem a variável configurada, ou com segredo errado, responde 401.
// Só LÊ as marcas; os únicos efeitos são os avisos e o registro deles (rotina_alertas). Não grava marca de vida de si mesmo.
export async function GET(request: NextRequest) {
  const segredo = process.env.VIGIA_SECRET;
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const relatorio = await rodarVigia();
    return NextResponse.json({ ok: true, ...relatorio });
  } catch (error) {
    console.error('[vigia-rotinas] Erro:', (error as { code?: string })?.code ?? 'erro');
    return NextResponse.json({ ok: false, error: 'Falha ao conferir as rotinas' }, { status: 500 });
  }
}
