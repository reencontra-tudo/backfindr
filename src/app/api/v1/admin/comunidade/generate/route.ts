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
  dica: `Escreva um artigo de dicas práticas sobre o tema solicitado.
Estrutura: título com termo buscável no Google, subtítulo com promessa prática, situação concreta que abre o texto (o problema real), orientação prática em etapas numeradas com ## para cada bloco, conclusão com reflexão.
Comece pelo problema — nunca por introdução genérica. Sem "neste artigo vamos ver".
O Backfindr pode aparecer quando fizer sentido orgânico — não force.
Tamanho: 400 a 600 palavras.
Palavras proibidas: revoluciona, inovador, disruptivo, game changer, especialistas afirmam, estudos mostram.`,

  caso: `Escreva um relato no estilo caso real — uma situação reconhecível, não necessariamente documentada, mas que o leitor sinta que poderia ter acontecido com alguém que ele conhece.
Estrutura: título que desperta curiosidade, subtítulo contextual, narrativa com ## para "O que aconteceu", "Como a recuperação ocorreu", "O que tornou possível", "Lição aprendida".
Sem identificar ninguém. Detalhes realistas. Tom jornalístico leve.
O Backfindr aparece de forma natural, nunca publicitária.
Tamanho: 350 a 500 palavras.`,

  guia: `Escreva um guia completo sobre o tema, voltado para quem perdeu ou pode perder algo no Brasil.
Estrutura: título com palavra-chave buscável, subtítulo descritivo, introdução de 2 parágrafos que vai direto ao problema, seções em ## com conteúdo denso, checklist ou tabela quando útil, conclusão prática.
Tom de especialista acessível — não acadêmico, não corporativo.
O Backfindr como ferramenta complementar, não como foco.
Tamanho: mínimo 600 palavras.`,

  debate: `Escreva um texto que provoca debate genuíno sobre comportamento social relacionado a objetos perdidos e devoluções.
Estrutura: título em forma de pergunta ou afirmação provocativa, subtítulo que contextualiza, apresentação da situação em até 3 linhas, problema explicado brevemente, UMA única pergunta simples ao final que convide comentários.
Sem resposta — só provocação. Sem dois lados longos. Direto e instigante.
Tamanho: máximo 300 palavras.`,

  novidade: `Escreva sobre uma funcionalidade ou melhoria do Backfindr começando pelo problema que ela resolve — nunca pela funcionalidade em si.
Estrutura: título com o que mudou, subtítulo do impacto para o usuário, contexto do problema que existia antes, como o recurso resolve, como usar em passos práticos com Markdown, encerramento em tom de conversa.
Sem release corporativo. Sem "temos o prazer de anunciar". Como alguém contando o que construiu.
Tamanho: 300 a 450 palavras.`,

  seguranca: `Escreva sobre segurança pessoal e proteção de objetos no Brasil.
Estrutura: título com urgência real (não alarmismo), subtítulo propositivo, abertura com situação reconhecível, risco concreto explicado sem exagero, como evitar em passos práticos com ##, conclusão tranquilizadora e prática.
Tom educativo de quem conhece o problema — não de quem quer assustar.
O Backfindr como camada adicional de proteção, não como solução mágica.
Tamanho: 400 a 550 palavras.`,
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
    ? `Tema específico solicitado: "${topic}"${casesContext}\n\n${categoryPrompt}`
    : `${categoryPrompt}${casesContext}`;

  const systemPrompt = `Você é o redator oficial do Backfindr. Escreve como alguém que passou anos observando casos reais de objetos perdidos, encontrados, furtados e recuperados. Conhece o problema por dentro. Não escreve para impressionar — escreve para ser lido até o final.

REGRA FUNDAMENTAL
O Backfindr não é um blog genérico. Cada texto deve parecer ter sido escrito especificamente para quem já perdeu algo, já encontrou algo, ou conhece alguém nessa situação. Se o texto pudesse estar em qualquer outro blog do mundo, está errado.

PRINCÍPIOS OBRIGATÓRIOS
1. Nunca invente estatísticas. Sem números, percentuais ou pesquisas que não possam ser comprovados. Sem "estudos mostram", "especialistas afirmam" ou "milhões de pessoas".
2. Escreva para pessoas comuns. Frases curtas. Linguagem simples. Sem corporativês, sem academicismo.
3. Ancora sempre em situações reais ou reconhecíveis. O leitor deve sentir que aquilo já aconteceu com alguém que ele conhece.
4. Mostre o problema central: o problema nunca foi perder. O problema sempre foi a desconexão. Alguém perdeu. Alguém encontrou. As informações nunca se cruzaram.
5. Não faça propaganda. O Backfindr pode ser citado quando fizer sentido orgânico. O foco é o problema e a solução.
6. Gere reflexão. O leitor deve pensar: isso já aconteceu comigo, eu conheço alguém assim, nunca tinha pensado nisso dessa forma.

SEO E PERFORMANCE ORGÂNICA
- Escreva para responder a intenção de busca — o que a pessoa digitaria no Google para chegar nesse texto.
- O título deve conter o termo principal de forma natural — nunca como tag de SEO.
- Comece pelo problema concreto nas primeiras 100 palavras. Nunca por introdução.
- Use H2 e H3 com variações naturais do tema — sinônimos e termos relacionados, não repetição.
- Densidade de palavra-chave entre 1% e 2%. Use variações naturais ao longo do texto.

FORMATO
Escreva SEMPRE em português brasileiro. NUNCA use inglês.
Markdown limpo. Comece com # Título (H1), subtítulo em parágrafo, corpo com ## seções.

PALAVRAS PROIBIDAS
Nunca usar: revoluciona, transforma o mercado, solução inovadora, tecnologia disruptiva, game changer, plataforma revolucionária, líder do setor, especialistas afirmam, estudos mostram, é fato que, inegavelmente, nos dias de hoje, em um mundo cada vez mais conectado.

TESTE FINAL
Antes de entregar, verifique: uma pessoa comum leria isso até o final? O texto responde o que alguém buscaria no Google? Esse conteúdo poderia estar em qualquer outro blog? Se sim para a última, reescreva.`;

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
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.70, // um pouco mais criativo para conteúdo editorial
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
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é especialista em SEO. Responda APENAS com JSON válido no formato {"seo_title": "...", "seo_desc": "..."}. Sem texto antes ou depois.',
          },
          {
            role: 'user',
            content: `Gere um título SEO (máx 60 chars) e descrição meta (máx 160 chars) em português para este artigo:\n\nTítulo: ${title}\n\nPrimeiros 300 chars do corpo: ${body.substring(0, 300)}`,
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

    // Extrair título, subtítulo e corpo do Markdown gerado
    const { title, subtitle, body: postBody } = extractTitleAndSubtitle(rawContent);

    // Gerar slug único
    const baseSlug = generateSlug(title);
    const timestamp = Date.now().toString(36);
    const slug = `${baseSlug}-${timestamp}`;

    // Gerar SEO em paralelo
    const { seo_title, seo_desc } = await generateSEO(title, postBody);

    // Gerar tags automáticas baseadas na categoria e topic
    const autoTags: string[] = [category];
    if (topic) {
      topic.split(/\s+/).filter(w => w.length > 4).slice(0, 3).forEach(w =>
        autoTags.push(w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      );
    }
    const defaultTagsByCategory: Record<Category, string[]> = {
      dica: ['dicas', 'objeto perdido', 'como recuperar'],
      caso: ['caso real', 'recuperação', 'São Paulo'],
      guia: ['guia', 'passo a passo', 'objeto perdido'],
      debate: ['debate', 'opinião', 'comportamento'],
      novidade: ['novidade', 'Backfindr', 'atualização'],
      seguranca: ['segurança', 'proteção', 'objeto perdido'],
    };
    const tags = [...new Set([...autoTags, ...defaultTagsByCategory[category]])];

    return NextResponse.json({
      // Dados prontos para salvar via POST /api/v1/admin/comunidade
      draft: {
        slug,
        title,
        subtitle,
        body: postBody,
        category,
        author_name: 'Equipe Backfindr',
        tags,
        status: 'draft', // sempre rascunho — admin revisa antes de publicar
        featured: false,
        seo_title,
        seo_desc,
        cover_url: '',
      },
      // Metadados da geração
      meta: {
        model: 'gpt-4.1-mini',
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
