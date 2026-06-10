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

function buildPrompt(cityName: string, stateName: string, category: string): string {
  const categoryLabel = CATEGORY_LABELS[category] ?? category;
  return `Você é redator SEO especializado em achados e perdidos no Brasil.

Crie conteúdo para a página: "Achados e Perdidos de ${categoryLabel} em ${cityName}, ${stateName}"

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
    {"question": "pergunta 3", "answer": "resposta 3"}
  ]
}

Regras:
- Mencione ${cityName} naturalmente no texto
- Foque em ações práticas e úteis
- Tom: direto, confiável, prestativo
- Não invente estatísticas
- Mencione o Backfindr como plataforma de achados e perdidos`;
}

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  try {
    const { municipality_id, category_slug } = await req.json();

    if (!municipality_id || !category_slug) {
      return NextResponse.json({ error: 'municipality_id e category_slug são obrigatórios' }, { status: 400 });
    }

    // Buscar dados da cidade
    const cityResult = await query(
      `SELECT name, state_name FROM municipalities WHERE id = $1`,
      [municipality_id]
    );
    const city = cityResult.rows[0];
    if (!city) return NextResponse.json({ error: 'Município não encontrado' }, { status: 404 });

    // Verificar se já existe
    const existing = await query(
      `SELECT id, status FROM local_pages WHERE municipality_id = $1 AND category_slug = $2`,
      [municipality_id, category_slug]
    );
    if (existing.rows[0]?.status === 'published') {
      return NextResponse.json({ error: 'Página já publicada. Use status=outdated para regenerar.' }, { status: 409 });
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
          { role: 'user', content: buildPrompt(city.name, city.state_name, category_slug) },
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

    // Salvar ou atualizar no banco
    if (existing.rows[0]) {
      await query(
        `UPDATE local_pages SET
          title=$1, meta_description=$2, hero_headline=$3, intro_text=$4,
          tips_content=$5, faq_content=$6, cta_text=$7, focus_keyword=$8,
          status='draft', generated_at=NOW(), last_updated=NOW()
         WHERE municipality_id=$9 AND category_slug=$10`,
        [
          content.title, content.meta_description, content.hero_headline,
          content.intro_text, content.tips_content, JSON.stringify(content.faq_content),
          content.cta_text, content.focus_keyword,
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

    return NextResponse.json({ success: true, city: city.name, category: category_slug, content });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
