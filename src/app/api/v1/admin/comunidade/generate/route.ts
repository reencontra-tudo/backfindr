export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Category = 'dica' | 'caso' | 'guia' | 'debate' | 'novidade' | 'seguranca';

interface GenerateRequest {
  category: Category;
  topic?: string;          // tema livre (ex: "carteira perdida no metrô")
  use_real_cases?: boolean; // usar objetos reais do banco como base
}

interface ObjectRow {
  title: string;
  category: string;
  location: string | null;
  description: string | null;
  created_at: string;
}

// ─── Prompts por categoria ────────────────────────────────────────────────────
const CATEGORY_PROMPTS: Record<Category, string> = {
  dica: `Escreva um artigo de utilidade pública com exatamente esta estrutura:

Parágrafo 1: Descreva uma situação real e específica onde alguém encontra ou perde um objeto. Sem emoção. Apenas a cena.
Parágrafo 2: Explique por que a situação é difícil — o que impede a devolução ou recuperação.
Parágrafo 3: Diga o que fazer de forma prática. Sem lista. Texto corrido.
Parágrafo 4: Explique os erros mais comuns que as pessoas cometem.
Parágrafo 5: Cite o Backfindr em no máximo 2 frases, de forma natural.
Parágrafo 6: Faça uma pergunta ao leitor baseada em experiência pessoal.

Proibido: emoções, sentimentos, memórias, metáforas, linguagem filosófica, linguagem poética.
Escreva como uma reportagem de utilidade pública. Entre 400 e 600 palavras.`,

  caso: `Escreva um relato realista com exatamente esta estrutura:

Parágrafo 1: Descreva a cena onde o objeto foi perdido ou encontrado. Hora, lugar, situação específica.
Parágrafo 2: O que quem perdeu fez imediatamente. Ações concretas, não sentimentos.
Parágrafo 3: O que quem encontrou fez. Ações concretas, não sentimentos.
Parágrafo 4: Por que os dois não se encontraram — cada um procurou em um lugar diferente.
Parágrafo 5: Como o objeto foi recuperado ou por que não foi.
Parágrafo 6: O que poderia ter facilitado a devolução. Cite o Backfindr se fizer sentido.
Parágrafo 7: Pergunta ao leitor baseada em experiência pessoal.

Proibido: emoções excessivas, metáforas, linguagem filosófica, inventar estatísticas.
Entre 400 e 600 palavras.`,

  guia: `Escreva um guia prático com subtítulos H2 e exatamente esta estrutura:

Abertura: Uma cena real que apresenta o problema.
## Por que isso acontece: Explique de forma simples e direta.
## O que fazer: Orientações práticas em texto corrido, sem lista numerada.
## Erros comuns: O que as pessoas fazem errado e por quê.
## Como o Backfindr ajuda: No máximo 3 frases, sem exagero.
Encerramento: Pergunta ao leitor.

Proibido: emoções, metáforas, linguagem filosófica, inventar dados.
Entre 600 e 900 palavras.`,

  debate: `Escreva um texto curto com exatamente esta estrutura:

Parágrafo 1: Uma situação real e específica — 2 ou 3 frases.
Parágrafo 2: Por que essa situação é comum e difícil — sem emoção, apenas fato.
Parágrafo 3: Uma pergunta direta ao leitor baseada em experiência pessoal.

Proibido: emoções, metáforas, linguagem filosófica, mais de 3 parágrafos.
Máximo 200 palavras. Direto ao ponto.`,

  novidade: `Escreva sobre o recurso do Backfindr com exatamente esta estrutura:

Parágrafo 1: O problema que existia antes do recurso — situação real, sem emoção.
Parágrafo 2: Como o recurso funciona — explicação simples e direta.
Parágrafo 3: Quem se beneficia e como usar — prático, sem exagero.
Parágrafo 4: Pergunta ao leitor.

Proibido: linguagem de press release, exagero, metáforas, emoções.
Entre 300 e 450 palavras.`,

  seguranca: `Escreva um artigo de prevenção com exatamente esta estrutura:

Parágrafo 1: Uma situação real onde alguém foi prejudicado por não tomar cuidado com objeto perdido.
Parágrafo 2: Quais cuidados básicos evitariam o problema — prático, sem alarmismo.
Parágrafo 3: Erros comuns que as pessoas cometem.
Parágrafo 4: Como o Backfindr ajuda na prevenção — no máximo 2 frases.
Parágrafo 5: Pergunta ao leitor.

Proibido: alarmismo, emoções, metáforas, linguagem filosófica.
Entre 350 e 500 palavras.`,
};

// ─── Gerar slug a partir do título ───────────────────────────────────────────
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

// ─── Extrair título e subtítulo do Markdown gerado ───────────────────────────
function extractTitleAndSubtitle(markdown: string): { title: string; subtitle: string; body: string } {
  const lines = markdown.split('\n').filter(l => l.trim());

  let title = '';
  let subtitle = '';
  let bodyStart = 0;

  // Procura primeiro H1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) {
      title = lines[i].replace(/^#\s+/, '').trim();
      bodyStart = i + 1;
      break;
    }
  }

  // Procura subtítulo logo depois do título (linha não-heading, não vazia)
  for (let i = bodyStart; i < Math.min(bodyStart + 3, lines.length); i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-')) {
      subtitle = line.replace(/\*\*/g, '').trim();
      bodyStart = i + 1;
      break;
    }
  }

  const body = lines.slice(bodyStart).join('\n').trim();

  return { title: title || 'Novo artigo', subtitle, body };
}

// ─── Buscar casos reais do banco para enriquecer o prompt ─────────────────────
async function fetchRealCases(category?: string): Promise<ObjectRow[]> {
  try {
    const categoryFilter = category && category !== 'debate' && category !== 'novidade'
      ? `AND o.category = $1`
      : '';
    const params = categoryFilter ? [category] : [];

    const result = await query(
      `SELECT title, category, location, description, created_at
       FROM objects o
       WHERE status IN ('lost', 'found', 'returned')
         AND title IS NOT NULL
         ${categoryFilter}
       ORDER BY created_at DESC
       LIMIT 5`,
      params
    );
    return result.rows as ObjectRow[];
  } catch {
    return [];
  }
}

// ─── Chamar OpenAI ────────────────────────────────────────────────────────────
async function generateWithAI(
  category: Category,
  topic: string,
  realCases: ObjectRow[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');

  const categoryPrompt = CATEGORY_PROMPTS[category];

  // Contexto de casos reais (quando disponível)
  const casesContext = realCases.length > 0
    ? `\n\nCasos reais recentes registrados na plataforma para usar como inspiração (não copie, use como contexto):\n${
        realCases.map(c =>
          `- "${c.title}" (${c.category || 'outro'})${c.location ? ` em ${c.location}` : ''}${c.description ? ` — ${c.description.substring(0, 100)}` : ''}`
        ).join('\n')
      }`
    : '';

  const userPrompt = topic
    ? `Categoria: ${category}\nTema: ${topic}${casesContext}\n\n${categoryPrompt}`
    : `Categoria: ${category}${casesContext}\n\n${categoryPrompt}`;

  const systemPrompt = `Você é o redator oficial da Comunidade Backfindr.
Sua função é gerar posts prontos para preencher os campos: título, subtítulo, conteúdo, título SEO, descrição SEO, tags e slug.
O Backfindr é uma plataforma para ajudar pessoas a registrar, localizar e recuperar objetos perdidos, encontrados, furtados, roubados e animais desaparecidos.

REGRA CENTRAL
O conteúdo deve ser útil, simples e humano.
Não escreva texto poético. Não escreva texto filosófico. Não escreva texto genérico de blog. Não escreva propaganda.

ESCREVA COMO
Um redator brasileiro experiente, claro, direto, observando situações reais do cotidiano.

NUNCA USE
conexão, desconexão, ponte, elo, laço, vínculo, jornada, mundos diferentes, caminhos que se cruzam, fio invisível, destino, narrativa, universo, histórias que se encontram.

NUNCA INVENTE
Estatísticas, pesquisas, percentuais, dados oficiais, nomes de órgãos ou números.

FORMATO DO CONTEÚDO
Comece com uma cena real e fácil de imaginar.
Explique o problema de forma simples.
Mostre por que a situação acontece.
Dê orientação prática quando fizer sentido — no texto corrido, sem listas numeradas.
Cite o Backfindr apenas de forma natural, sem exagero.
Termine com uma pergunta simples ou chamada para ação baseada em experiência pessoal do leitor.

TAMANHO
Conteúdo entre 350 e 700 palavras. Parágrafos curtos. Frases curtas. Linguagem de pessoa comum.

CATEGORIAS
DICA: Texto prático, simples, com orientação útil. Pode ter lista curta se ajudar.
SEGURANÇA: Foco em cuidados, prevenção, erros comuns e formas seguras de agir. Sem alarmismo.
CASO REAL: Conte uma situação possível e realista, com começo, desenvolvimento e desfecho. Não invente estatísticas.
GUIA: Pode ser mais didático, com subtítulos e passos claros.
DEBATE: Texto curto, até 300 palavras, com uma pergunta forte para gerar comentários.
NOVIDADE: Explique uma tecnologia ou recurso do Backfindr mostrando qual problema ela ajuda a resolver.

SEO
Título SEO com no máximo 60 caracteres.
Descrição SEO com no máximo 160 caracteres.
Tags separadas por vírgula.
Slug curto, descritivo, sem códigos aleatórios, sem acentos, sem caracteres especiais.

RETORNE APENAS JSON VÁLIDO, SEM MARKDOWN:
{
  "title": "",
  "subtitle": "",
  "content": "",
  "seo_title": "",
  "seo_desc": "",
  "tags": "",
  "slug": ""
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s para geração de conteúdo

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.7, // criativo mas controlado — estrutura por parágrafo
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Gerar SEO title e desc ───────────────────────────────────────────────────
async function generateSEO(title: string, body: string): Promise<{ seo_title: string; seo_desc: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { seo_title: title.substring(0, 60), seo_desc: '' };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é especialista em SEO para o Backfindr — plataforma de recuperação de objetos perdidos. Responda APENAS com JSON válido no formato {"seo_title": "...", "seo_desc": "..."}. Sem texto antes ou depois. IMPORTANTE: o título SEO deve soar como frase humana, nunca como tag de blog. Exemplos de títulos ruins: "Celular Perdido: Como Encontrar Rápido", "Dicas para Recuperar Objetos Perdidos". Exemplos de títulos bons: "O celular estava no banco do ônibus. E agora?", "Quem perdeu procura. Quem encontrou também. Mas os caminhos não se cruzam.", "A coisa mais difícil não é perder. É não saber quem encontrou."',
          },
          {
            role: 'user',
            content: `Gere um título SEO (máx 60 chars, estilo humano e reflexivo) e descrição meta (máx 160 chars, que desperte curiosidade) em português para este artigo:\n\nTítulo original: ${title}\n\nPrimeiros 300 chars do corpo: ${body.substring(0, 300)}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) return { seo_title: title.substring(0, 60), seo_desc: '' };

    const data = await response.json();
    const raw = data.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return {
      seo_title: (parsed.seo_title || title).substring(0, 60),
      seo_desc: (parsed.seo_desc || '').substring(0, 160),
    };
  } catch {
    return { seo_title: title.substring(0, 60), seo_desc: '' };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/admin/comunidade/generate
 *
 * Gera um rascunho de post para a Comunidade usando gpt-4.1-mini.
 * Retorna o post pronto para ser salvo (não salva automaticamente — o admin revisa antes).
 *
 * Body: { category, topic?, use_real_cases? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { detail: 'OPENAI_API_KEY não configurada no ambiente' },
      { status: 503 }
    );
  }

  try {
    const body: GenerateRequest = await req.json();
    const { category, topic, use_real_cases = true } = body;

    const validCategories: Category[] = ['dica', 'caso', 'guia', 'debate', 'novidade', 'seguranca'];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json(
        { detail: `Categoria inválida. Use: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Buscar casos reais para enriquecer o conteúdo (opcional)
    const realCases = use_real_cases ? await fetchRealCases(category) : [];

    // Gerar conteúdo com IA
    const rawContent = await generateWithAI(category, topic || '', realCases);
    if (!rawContent) {
      return NextResponse.json({ detail: 'IA não retornou conteúdo' }, { status: 500 });
    }

    // Parsear JSON retornado diretamente pela IA
    let parsed: {
      title?: string; subtitle?: string; content?: string;
      seo_title?: string; seo_desc?: string; tags?: string; slug?: string;
    } = {};
    try {
      const clean = rawContent.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      const extracted = extractTitleAndSubtitle(rawContent);
      parsed = { title: extracted.title, subtitle: extracted.subtitle, content: extracted.body };
    }

    const title = parsed.title || 'Novo artigo';
    const subtitle = parsed.subtitle || '';
    const postBody = parsed.content || rawContent;
    const seo_title = (parsed.seo_title || title).substring(0, 60);
    const seo_desc = (parsed.seo_desc || '').substring(0, 160);
    const tags = parsed.tags
      ? parsed.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [category, 'objeto perdido', 'Backfindr'];
    const slug = parsed.slug
      ? parsed.slug.substring(0, 80)
      : `${generateSlug(title)}-${Date.now().toString(36)}`;

    return NextResponse.json({
      draft: {
        slug,
        title,
        subtitle,
        body: postBody,
        category,
        author_name: 'Equipe Backfindr',
        tags,
        status: 'draft',
        featured: false,
        seo_title,
        seo_desc,
        cover_url: '',
      },
      meta: {
        model: 'gpt-4o-mini',
        real_cases_used: realCases.length,
        topic_used: topic || null,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[admin/comunidade/generate]', err);
    const message = err instanceof Error ? err.message : 'Erro ao gerar conteúdo';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
