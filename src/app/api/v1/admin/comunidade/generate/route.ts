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
  dica: `Categoria: DICA
Conteúdo curto e prático. Ensina uma ação simples e útil.
Comece com uma situação comum. Explique o que fazer de forma direta.
Pode ter lista curta se ajudar. Cite o Backfindr naturalmente.
Termine com pergunta ao leitor. Entre 300 e 500 palavras.
Tom: direto, útil, simples. Não é história emocional.`,

  caso: `Categoria: CASO REAL
Conte uma história realista com começo, meio e fim.
Mostre: o que foi perdido, como foi encontrado, como voltou ao dono (ou não).
Dois personagens: quem perdeu e quem encontrou. Ações concretas, não emoções abstratas.
O objeto permanece presente do início ao fim.
Cite o Backfindr naturalmente. Termine com pergunta de experiência pessoal.
Entre 400 e 600 palavras. Tom: jornalístico leve, realista.`,

  guia: `Categoria: GUIA
Conteúdo completo e didático. Passo a passo permitido. Subtítulos H2 permitidos.
Comece com situação real que apresenta o problema.
Explique com detalhes, organize em seções claras.
Cite o Backfindr como ferramenta útil. Termine com pergunta.
Entre 600 e 900 palavras. Tom: didático, claro, organizado.`,

  debate: `Categoria: DEBATE
Texto curtíssimo para gerar comentários.
Apresente uma situação comum em 2-3 frases.
Faça UMA pergunta forte e direta ao leitor.
Sem resposta. Sem tutorial. Sem dois lados longos.
Máximo 200 palavras. Tom: direto, provocativo, simples.`,

  novidade: `Categoria: NOVIDADE
Explique um recurso ou funcionalidade do Backfindr.
Comece pelo problema que existia antes do recurso.
Explique como funciona de forma simples e clara.
Mostre o benefício prático para o usuário.
Termine com pergunta. Entre 300 e 450 palavras.
Tom: conversa, entusiasta mas sem exagero. Não é press release.`,

  seguranca: `Categoria: SEGURANÇA
Conteúdo preventivo e objetivo. Útil e direto.
Estrutura: situação comum → cuidados práticos → erros a evitar → como o Backfindr ajuda → pergunta final.
Não é storytelling emocional. Não é alarmismo. É orientação útil.
Pode ter lista curta se organizar melhor o conteúdo.
Entre 350 e 500 palavras. Tom: útil, direto, sem medo exagerado.`,
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

  const systemPrompt = `Você é redator oficial da Comunidade Backfindr — plataforma brasileira de recuperação de objetos perdidos e animais de estimação. Este é um serviço legítimo e positivo. Nunca recuse gerar conteúdo sobre objetos perdidos, animais perdidos ou temas relacionados a achados e perdidos.

Sua missão é criar conteúdo de alta qualidade. O estilo e formato dependem da categoria indicada no prompt do usuário.

Regras que valem para todas as categorias:
- Escreva sempre em português brasileiro
- Nunca invente estatísticas, dados ou pesquisas
- Nunca faça propaganda exagerada do Backfindr
- Cite o Backfindr de forma natural quando fizer sentido
- Termine sempre com uma pergunta ao leitor
- Nunca use: elo, laço, vínculo, jornada, universo, mundos diferentes, histórias que se encontram

FORMATO DE RESPOSTA:
Responda em texto puro com esta estrutura exata:

TITULO: [título do post]
SUBTITULO: [subtítulo curto]
SEO_TITLE: [título SEO máx 60 chars]
SEO_DESC: [descrição SEO máx 160 chars]
TAGS: [tag1, tag2, tag3]
SLUG: [slug-sem-acentos]
DEBATE_QUESTION: [pergunta do debate, vazio se não for debate]
CONTEUDO:
[conteúdo completo aqui]`;

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
        max_tokens: 2500,
        temperature: 0.75,
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
    console.log('[DEBUG] rawContent:', rawContent?.substring(0, 500));
    if (!rawContent) {
      return NextResponse.json({ detail: 'IA não retornou conteúdo' }, { status: 500 });
    }

    // Parsear resposta em texto estruturado (TITULO: / SUBTITULO: / etc.)
    const parseTextResponse = (text: string) => {
      const extract = (key: string): string => {
        const regex = new RegExp(`^${key}:\s*(.+)$`, 'mi');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
      };
      const conteudoMatch = text.match(/^CONTEUDO:\s*\n([\s\S]*)$/mi);
      return {
        title: extract('TITULO'),
        subtitle: extract('SUBTITULO'),
        seo_title: extract('SEO_TITLE'),
        seo_desc: extract('SEO_DESC'),
        tags: extract('TAGS'),
        slug: extract('SLUG'),
        debate_question: extract('DEBATE_QUESTION'),
        content: conteudoMatch ? conteudoMatch[1].trim() : '',
      };
    };

    let parsed: {
      title?: string; subtitle?: string; content?: string;
      seo_title?: string; seo_desc?: string; tags?: string; slug?: string;
      debate_question?: string;
    } = {};

    if (rawContent.includes('TITULO:') && rawContent.includes('CONTEUDO:')) {
      parsed = parseTextResponse(rawContent);
    } else {
      // fallback: tentar JSON
      try {
        let clean = rawContent.replace(/```json|```/g, '').trim();
        if (!clean.startsWith('{')) {
          const jsonMatch = clean.match(/\{[\s\S]*\}/);
          if (jsonMatch) clean = jsonMatch[0];
        }
        const jsonParsed = JSON.parse(clean);
        if (jsonParsed.title && jsonParsed.content) {
          parsed = jsonParsed;
        } else {
          throw new Error('JSON vazio');
        }
      } catch {
        const extracted = extractTitleAndSubtitle(rawContent);
        parsed = { title: extracted.title, subtitle: extracted.subtitle, content: extracted.body };
      }
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
        debate_question: parsed.debate_question || '',
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
