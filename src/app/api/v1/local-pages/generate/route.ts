export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

const CATEGORY_LABELS: Record<string, string> = {
  celular: 'celular/smartphone',
  pet: 'pet/animal de estimação',
  documento: 'documento (RG, CPF, carteira)',
  veiculo: 'veículo (carro, moto)',
  chave: 'chave',
  bagagem: 'bagagem/mochila',
  geral: 'objeto perdido',
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  founding_date: 'Data de fundação',
  municipal_holiday: 'Feriado municipal',
  festival: 'Festa/evento tradicional',
};

interface MunicipalityEvent {
  event_type: string;
  name: string;
  description: string | null;
  date_text: string | null;
  month: number | null;
  day: number | null;
}

interface CityContext {
  name: string;
  state_name: string;
  total_objects_registered: number | null;
  category_breakdown: Record<string, number> | null;
  main_landmarks: string[] | null;
  police_contact: string | null;
  police_contact_notes: string | null;
}

// ── Escolha do evento aplicável (item C/D, 21/08/2026) ──────────────────────
// Mesma regra usada em src/app/achados-perdidos/[cidade]/[categoria]/page.tsx:
// prioriza evento do mês atual (relevância sazonal); sem isso, cai pra
// founding_date, que é fato histórico sempre válido, não depende de época
// do ano. Mantém as duas rotas consistentes na mesma decisão.
function pickApplicableEvent(events: MunicipalityEvent[]): MunicipalityEvent | null {
  if (events.length === 0) return null;
  const currentMonth = new Date().getMonth() + 1;
  return (
    events.find((e) => e.month === currentMonth) ??
    events.find((e) => e.event_type === 'founding_date') ??
    events[0]
  );
}

// ── Prompt com grounding obrigatório (item D, 21/08/2026) ───────────────────
// Antes desta mudança, buildPrompt() só recebia cidade/estado/categoria — o
// LLM preenchia o resto por conta própria, sem nada que garantisse
// especificidade real por cidade. Agora todo fato citável vem de uma lista
// fechada (FATOS REAIS) construída a partir do que já está gravado no banco
// (estatísticas reais via refresh-stats, main_landmarks, police_contact,
// municipality_events) — a instrução explícita é nunca extrapolar além
// dessa lista. Regra de omissão graciosa pra police_contact null: nunca
// inventar telefone/nome de delegacia, só orientar de forma genérica.
function buildPrompt(
  cityName: string,
  stateName: string,
  category: string,
  ctx: CityContext,
  applicableEvent: MunicipalityEvent | null
): string {
  const categoryLabel = CATEGORY_LABELS[category] ?? category;
  const breakdown = ctx.category_breakdown ?? {};
  const totalCount = ctx.total_objects_registered ?? 0;
  const categoryCount = breakdown[category] ?? 0;
  const landmarks = ctx.main_landmarks ?? [];

  // Nota sobre o par total/categoria (achado na amostra de 5 cidades,
  // 21/08/2026): pra categoria "geral" as duas linhas descrevem números
  // diferentes mas de nomes parecidos ("objeto perdido" é tanto o rótulo
  // da página quanto um dos 7 slugs de category_breakdown) — em 1 de 5
  // cidades testadas o LLM confundiu as duas e citou o número da
  // categoria com a moldura do total da região. Pra "geral" só o total
  // entra na lista de fatos; o recorte por categoria só faz sentido (e só
  // é inequívoco) nas páginas de categoria específica.
  const facts: string[] = [];
  if (totalCount > 0) {
    facts.push(`- TOTAL de objetos já registrados em toda a região de ${cityName} (todas as categorias somadas): ${totalCount}`);
  }
  if (category !== 'geral' && categoryCount > 0) {
    facts.push(`- Desse total, quantos são especificamente da categoria "${categoryLabel}" (não confundir com o total acima): ${categoryCount}`);
  }
  if (landmarks.length > 0) {
    facts.push(`- Pontos de referência conhecidos da cidade: ${landmarks.join(', ')}`);
  }
  if (ctx.police_contact) {
    facts.push(`- Telefone de delegacia/unidade policial de referência: ${ctx.police_contact}`);
  } else {
    facts.push(
      `- NÃO há telefone de delegacia específico confirmado pra esta cidade. NUNCA invente um número ou nome de unidade — oriente de forma genérica ("procure a delegacia mais próxima" ou "contate a Polícia Civil de ${stateName}").`
    );
  }
  if (applicableEvent) {
    const eventLabel = EVENT_TYPE_LABEL[applicableEvent.event_type] ?? 'Data local';
    facts.push(
      `- ${eventLabel}: ${applicableEvent.name}${applicableEvent.date_text ? ` (${applicableEvent.date_text})` : ''}${applicableEvent.description ? ` — ${applicableEvent.description}` : ''}`
    );
  }

  return `Você é redator SEO especializado em achados e perdidos no Brasil.

Crie conteúdo para a página: "Achados e Perdidos de ${categoryLabel} em ${cityName}, ${stateName}"

FATOS REAIS DESTA CIDADE (única fonte de dados permitida pra citar números, telefones, nomes de lugares ou datas — nunca invente nada além do que está listado aqui; se um fato não estiver na lista, não o mencione):
${facts.length > 0 ? facts.join('\n') : '- Nenhum dado adicional disponível para esta cidade além do nome e estado.'}

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "title": "título SEO (máx 60 chars, inclui cidade e categoria)",
  "meta_description": "descrição SEO (máx 155 chars)",
  "hero_headline": "título principal da página (max 80 chars, direto e útil)",
  "intro_text": "parágrafo HTML de introdução (150-200 palavras, menciona ${cityName} e ${categoryLabel}, menciona Backfindr como ferramenta)",
  "tips_content": "HTML com 3-4 dicas práticas em <ul><li> sobre o que fazer ao perder/achar ${categoryLabel} em ${cityName}",
  "cta_text": "texto do call-to-action (max 80 chars)",
  "focus_keyword": "palavra-chave principal",
  "faq_content": [
    {"question": "pergunta 1", "answer": "resposta 1"},
    {"question": "pergunta 2", "answer": "resposta 2"},
    {"question": "pergunta 3", "answer": "resposta 3"}${
      applicableEvent
        ? `,\n    {"question": "pergunta sobre ${applicableEvent.name}", "answer": "resposta usando só o fato fornecido acima sobre ${applicableEvent.name}"}`
        : ''
    }
  ]
}

Regras:
- Mencione ${cityName} naturalmente no texto
- Use os FATOS REAIS acima quando fizerem sentido no texto — eles são o que torna esta página específica de ${cityName}, não genérica
- NUNCA invente estatística, telefone, nome de delegacia, data ou fato que não esteja na lista de FATOS REAIS
- Quando a lista disser que não há telefone confirmado, oriente de forma genérica ("procure a delegacia mais próxima", "contate a Polícia Civil de ${stateName}") — nunca invente um número ou nome de unidade
${applicableEvent ? `- Inclua a 4ª pergunta de FAQ sobre "${applicableEvent.name}", usando somente a informação fornecida nos FATOS REAIS` : '- Não inclua uma 4ª pergunta de FAQ — não há evento aplicável pra esta cidade'}
- Foque em ações práticas e úteis
- Tom: direto, confiável, prestativo
- Mencione o Backfindr como plataforma de achados e perdidos`;
}

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { municipality_id, category_slug, regenerate } = await req.json();

    if (!municipality_id || !category_slug) {
      return NextResponse.json({ error: 'municipality_id e category_slug são obrigatórios' }, { status: 400 });
    }

    // Buscar dados reais da cidade — agora inclui tudo que vira grounding do
    // prompt (item D, 21/08/2026): estatísticas, landmarks e police_contact.
    const cityResult = await query(
      `SELECT name, state_name, total_objects_registered, category_breakdown,
              main_landmarks, police_contact, police_contact_notes
       FROM municipalities WHERE id = $1`,
      [municipality_id]
    );
    const city = cityResult.rows[0];
    if (!city) return NextResponse.json({ error: 'Município não encontrado' }, { status: 404 });

    const eventsResult = await query(
      `SELECT event_type, name, description, date_text, month, day
       FROM municipality_events WHERE municipality_id = $1 ORDER BY event_type`,
      [municipality_id]
    );
    const applicableEvent = pickApplicableEvent(eventsResult.rows as MunicipalityEvent[]);

    // Verificar se já existe
    const existing = await query(
      `SELECT id, status FROM local_pages WHERE municipality_id = $1 AND category_slug = $2`,
      [municipality_id, category_slug]
    );
    // `regenerate: true` é o único jeito de sobrescrever uma página já
    // publicada (item D, 21/08/2026) — sem isso, published continua
    // protegida contra reescrita acidental, mesmo comportamento de antes.
    if (existing.rows[0]?.status === 'published' && !regenerate) {
      return NextResponse.json(
        { error: 'Página já publicada. Passe regenerate=true pra regenerar mantendo published.' },
        { status: 409 }
      );
    }

    // Gerar conteúdo via OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'Você é redator SEO. Retorne apenas JSON válido, sem markdown, sem explicações.' },
          { role: 'user', content: buildPrompt(city.name, city.state_name, category_slug, city, applicableEvent) },
        ],
      }),
    });

    if (!openaiRes.ok) {
      return NextResponse.json({ error: 'Erro ao chamar OpenAI' }, { status: 500 });
    }

    const openaiData = await openaiRes.json();
    const raw = openaiData.choices?.[0]?.message?.content ?? '';

    let content: any;
    try {
      content = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return NextResponse.json({ error: 'Resposta da IA inválida', raw }, { status: 500 });
    }

    // Salvar ou atualizar no banco. Regenerando uma página published, o
    // status permanece 'published' — cair pra 'draft' tiraria a página do
    // ar (page.tsx só faz SELECT com status = 'published'), o que não é o
    // objetivo de uma regeneração de conteúdo já no ar.
    const wasPublished = existing.rows[0]?.status === 'published';
    const newStatus = wasPublished ? 'published' : 'draft';

    if (existing.rows[0]) {
      await query(
        `UPDATE local_pages SET
          title=$1, meta_description=$2, hero_headline=$3, intro_text=$4,
          tips_content=$5, faq_content=$6, cta_text=$7, focus_keyword=$8,
          status=$9, generated_at=NOW(), last_updated=NOW()
         WHERE municipality_id=$10 AND category_slug=$11`,
        [
          content.title, content.meta_description, content.hero_headline,
          content.intro_text, content.tips_content, JSON.stringify(content.faq_content),
          content.cta_text, content.focus_keyword, newStatus,
          municipality_id, category_slug,
        ]
      );
    } else {
      await query(
        `INSERT INTO local_pages
          (municipality_id, category_slug, title, meta_description, hero_headline,
           intro_text, tips_content, faq_content, cta_text, focus_keyword, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')`,
        [
          municipality_id, category_slug, content.title, content.meta_description,
          content.hero_headline, content.intro_text, content.tips_content,
          JSON.stringify(content.faq_content), content.cta_text, content.focus_keyword,
        ]
      );
    }

    return NextResponse.json({ success: true, city: city.name, category: category_slug, status: newStatus, content });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
