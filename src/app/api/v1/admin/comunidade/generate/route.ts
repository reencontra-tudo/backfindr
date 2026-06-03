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
  dica: `Escreva uma reflexão humana sobre uma situação comum envolvendo objetos perdidos.
Não escreva tutorial. Não escreva passo a passo. Não escreva lista de dicas.
Mostre uma situação real que faça o leitor pensar sobre a desconexão entre quem perdeu e quem encontrou.
Termine com uma pergunta baseada em experiência pessoal do leitor.
Máximo 300 palavras.`,

  caso: `Escreva uma narrativa humana inspirada em uma situação possível envolvendo objeto perdido.
O foco não é o objeto. O foco são as pessoas tentando se reencontrar — e não conseguindo.
Mostre os dois lados: quem perdeu e quem encontrou, cada um procurando em um lugar diferente.
Termine com uma pergunta que gere identificação.
Máximo 300 palavras.`,

  guia: `Escreva uma reflexão mais longa sobre o tema — não um guia técnico.
Explore o problema da desconexão com profundidade: por que quem perdeu e quem encontrou raramente se encontram?
Use situações concretas e reconhecíveis. Nada de listas ou passos.
Termine com reflexão ou pergunta aberta.
Máximo 500 palavras.`,

  debate: `Escreva uma reflexão curta que provoque comentários.
Apresente uma situação comum. Mostre o problema da desconexão. Faça uma pergunta simples ao final que gere identificação pessoal.
A pergunta deve ser sobre experiência real do leitor — não abstrata.
Máximo 250 palavras.`,

  novidade: `Escreva sobre uma funcionalidade do Backfindr começando pela situação humana que ela resolve.
Não anuncie a funcionalidade — mostre o problema que existia antes dela.
Tom de conversa, como alguém contando o que construiu e por quê.
Máximo 350 palavras.`,

  seguranca: `Escreva uma reflexão sobre como objetos perdidos afetam as pessoas — emocionalmente, não tecnicamente.
O foco é a desconexão: quem perdeu procura de um lado, quem encontrou procura do outro.
Nada de alertas, riscos ou conselhos de segurança.
Termine com pergunta de experiência pessoal.
Máximo 300 palavras.`,
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

  const systemPrompt = `Você é redator especialista em SEO, comportamento humano, objetos perdidos, objetos encontrados, roubos, devoluções e recuperação de bens.

Sua missão é escrever artigos para o blog do Backfindr.

OBJETIVO PRINCIPAL
Fazer o leitor se identificar imediatamente com a situação apresentada.
O texto deve gerar reflexão, comentários, compartilhamentos e tempo de leitura.
O leitor deve terminar o artigo pensando:
"Já passei por isso."
ou
"Isso pode acontecer comigo."
ou
"Eu nunca tinha pensado por esse lado."

ESTILO DE ESCRITA
Linguagem humana, simples, realista, conversacional e brasileira.
Fácil de ler. Frases curtas. Parágrafos curtos.
Tom reflexivo. Tom jornalístico leve. Tom emocional moderado.
Não escrever como vendedor. Não escrever como propaganda. Não escrever como IA.

PROIBIDO
Linguagem poética, filosófica, motivacional, de coach ou corporativa.

NÃO USE ESSAS PALAVRAS
conexão, conectar, desconexão, ponte, laço, vínculo, jornada, universo, mundos diferentes, caminhos que se cruzam, destinos, reencontro de histórias, fio invisível, elo invisível, narrativa, ecossistema.

NÃO USE METÁFORAS.
NÃO USE FRASES GENÉRICAS.
NÃO USE TEXTO FLOREADO.
NÃO FAÇA PROPAGANDA EXAGERADA DO BACKFINDR.

ESTRUTURA OBRIGATÓRIA

1. Abrir com uma cena real e específica.
Exemplo:
"O celular está sobre a mesa da cafeteria. O café já esfriou. O dono foi embora há alguns minutos sem perceber."
ou
"A carteira caiu ao lado do caixa do supermercado. Ninguém viu."
ou
"O cachorro atravessa a rua sem direção. Não parece agressivo. Só parece perdido."

2. Desenvolver o problema.
Mostrar o que sente quem perdeu, o que pensa quem encontrou, por que a situação é difícil e por que tantas devoluções não acontecem.

3. Trazer informações úteis.
Explicar formas corretas de agir e erros comuns — sem listas numeradas, sem passos, sem tutoriais. Integre no texto corrido.

4. Introduzir o Backfindr naturalmente.
Não vender. Não prometer. Não exagerar.
Exemplo: "Foi justamente para diminuir esse tipo de dificuldade que surgiram plataformas especializadas em objetos perdidos e encontrados, como o Backfindr."

5. Encerrar com pergunta de experiência pessoal.
Exemplos:
"Você já passou por isso?"
"Como você agiria nessa situação?"
"Já encontrou algo e não conseguiu localizar o dono?"

SEO
Título entre 50 e 60 caracteres.
Descrição SEO entre 120 e 160 caracteres.
Utilizar palavras-chave relacionadas ao tema.
Criar subtítulos H2 naturais quando necessário.
Produzir entre 800 e 1200 palavras.

FORMATO
Escreva SEMPRE em português brasileiro.
A PRIMEIRA linha DEVE ser o título: # Título aqui
Depois uma linha de subtítulo em parágrafo simples.
Depois o corpo do texto.

IMPORTANTE
O artigo deve parecer escrito por alguém que observou uma situação real acontecendo naquele momento.
Antes de finalizar, revise e elimine qualquer frase que pareça poética, filosófica ou artificial.`;

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
        temperature: 0.85, // liberdade narrativa — reflexão humana, não artigo
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
