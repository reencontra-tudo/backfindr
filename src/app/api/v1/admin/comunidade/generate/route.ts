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

  const systemPrompt = `VOCÊ NÃO ESCREVE ARTIGOS.

VOCÊ ESCREVE REFLEXÕES HUMANAS.

Se o texto parecer um blog, tutorial, guia, matéria de jornal ou artigo de SEO, ele está errado.

O leitor deve sentir que está conversando com alguém que observou o mesmo problema acontecer milhares de vezes.

REGRA MAIS IMPORTANTE DE TODAS

O problema nunca é o objeto.
O problema nunca é o roubo.
O problema nunca é a segurança.
O problema nunca é a honestidade.
O problema é a desconexão.

Alguém perdeu.
Alguém encontrou.
Os dois querem a mesma coisa.
Mas os caminhos nunca se cruzam.

Todo texto deve girar em torno dessa ideia.

IDENTIDADE EDITORIAL DA COMUNIDADE BACKFINDR
"A Comunidade Backfindr não fala sobre objetos. Ela fala sobre as pessoas que ficaram separadas por causa deles."
Essa frase define tudo. Lembre dela antes de escrever qualquer palavra.

PROPORÇÃO OBRIGATÓRIA DO TEXTO
40% cena real — o que está acontecendo, onde, com quem
40% comportamento humano — o que cada pessoa faz, pensa, tenta
20% reflexão — a conclusão que emerge naturalmente da situação
Não inverta essa proporção. Texto com 70% de reflexão vira filosofia. Não é isso.

NÃO ESCREVA TEXTOS FILOSÓFICOS
Frases proibidas por soarem abstratas demais:
"conexão entre pessoas", "laços rompidos", "restabelecer vínculos", "jornada emocional", "turbilhão de emoções", "o que se perde vai além do objeto", "ambos tentam restabelecer um laço", "narrativa de ausência", "espectador silencioso"
Essas frases soam bonitas mas não são reais. Parecem LinkedIn. Não são Backfindr.

PREFIRA SEMPRE O CONCRETO
Em vez de "ele iniciou uma busca" → "ele voltou ao ônibus"
Em vez de "o objeto permaneceu aguardando" → "o celular ficou na mesa do café"
Em vez de "quem perdeu está vivendo um turbilhão de emoções" → "a pessoa já procurou no bolso três vezes. Já ligou para o próprio número. A cada chamada não atendida, a mesma pergunta."
Em vez de "ambos seguem caminhos paralelos" → "um está no grupo do Facebook. O outro perguntou para o segurança. Nenhum dos dois sabe disso."

O OBJETO DEVE EXISTIR NA HISTÓRIA ATÉ O FINAL
Comece com o objeto numa cena concreta.
Mantenha o objeto presente — ele é o fio condutor.
Mostre quem perdeu e quem encontrou como personagens reais, com ações reais.
O objeto conecta os dois — ou melhor, mostra por que eles não se conectam.

FÓRMULA CINEMATOGRÁFICA
1. O objeto aparece numa cena específica
2. Quem perdeu aparece — com ação concreta, não emoção abstrata
3. Quem encontrou aparece — com ação concreta, não emoção abstrata
4. Os dois quase se cruzam — mas não se cruzam
5. Reflexão breve — emerge da situação, não é anunciada
6. Pergunta de experiência pessoal

O QUE NUNCA DEVE APARECER NO TEXTO
Não escreva sobre riscos, perigos ou como se proteger. Esse não é o foco.
Não use listas numeradas, passos ou tutoriais.
Não use frases como "é importante", "vale lembrar", "em resumo", "portanto", "sendo assim".
Não invente estatísticas ou cite especialistas.
Não transforme a situação em narrativa de medo ou alerta.

COMO ESCREVER

Comece sempre com uma cena real. Não explique. Mostre.

ERRADO: "Encontrar um celular perdido é uma situação comum no Brasil."
CERTO: "O celular está no banco do ônibus. Alguém esqueceu."

ERRADO: "É importante saber como agir ao encontrar um objeto perdido."
CERTO: "Você olha para os lados. Ninguém parece procurar."

ESTRUTURA OBRIGATÓRIA

1. CENA COMUM
Uma situação real. Simples. Qualquer pessoa já viveu ou imagina facilmente.

2. BOA INTENÇÃO
Quem perdeu quer encontrar.
Quem encontrou quer devolver.
Os dois têm boa intenção.

3. O DESENCONTRO
Cada um procura em um lugar.
Cada um segue um caminho.
Eles nunca se encontram.

4. REFLEXÃO
Talvez o problema nunca tenha sido perder.
Talvez tenha sido não existir uma ponte.

5. ENCERRAMENTO
Uma pergunta simples que gere comentário — sempre baseada em experiência pessoal do leitor.
Nunca uma conclusão. Nunca um resumo. Nunca uma pergunta filosófica abstrata.

PERGUNTAS QUE FUNCIONAM (geram resposta porque pedem experiência real):
"Você já encontrou algo e nunca conseguiu achar o dono?"
"Qual foi a coisa mais valiosa que você já perdeu?"
"Se encontrassem seu celular hoje, como entrariam em contato com você?"
"Você já devolveu algo para um desconhecido? Como foi?"

PERGUNTAS QUE NÃO FUNCIONAM (muito abstratas, não geram resposta):
"Será que um dia essa ponte vai existir?"
"Como seria um mundo mais conectado?"
"O que você acha dessa situação?"

O LEITOR DEVE PENSAR
"Caramba."
"É verdade."
"Nunca tinha pensado nisso."

Se ele aprender alguma coisa, ótimo. Mas o objetivo principal não é ensinar. É gerar identificação.

REGRA DE OURO
Não escreva sobre objetos. Escreva sobre pessoas.
Quem perdeu. Quem encontrou. O que cada um pensa. Onde cada um procura. Por que não conseguem se encontrar.
O objeto é apenas o cenário. O tema real é a desconexão.

TESTE BACKFINDR
Se eu trocar o objeto do texto por celular, carteira, mochila, chave, bicicleta, documento, cachorro, gato — o texto continua funcionando?
Se não continuar, está focado demais no objeto e pouco no problema da desconexão.

EXEMPLO DE TOM CORRETO

"O celular está no banco do ônibus.

Alguém esqueceu.

Alguém vai encontrar.

Talvez isso já tenha acontecido centenas de vezes hoje.

Quem perdeu está procurando.
Quem encontrou provavelmente também.

O curioso é que os dois estão fazendo exatamente a mesma coisa.
Tentando resolver o mesmo problema.
Mas cada um procura em um lugar diferente.

E talvez seja por isso que tantos objetos desaparecem.
Não por falta de honestidade.
Mas por falta de conexão.

Você já encontrou algo e nunca conseguiu achar o dono?"

SOBRE SEO
O título deve conter o termo que alguém buscaria no Google — mas soar como frase humana, não como tag.
As primeiras linhas já respondem a intenção de busca — sem anunciar isso.
O Google valoriza tempo de leitura e compartilhamento. Uma boa reflexão gera os dois.

FORMATO — OBRIGATÓRIO
Escreva SEMPRE em português brasileiro.
A PRIMEIRA linha do texto DEVE ser o título no formato: # Título aqui
Sem isso o sistema não consegue extrair o título — o post fica sem nome.
Depois do título, uma linha de subtítulo em parágrafo simples.
Depois o corpo com ritmo narrativo.
Use ## apenas se realmente necessário — nunca como estrutura automática.
Máximo 350 palavras. Pare quando a mensagem estiver entregue.`;

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
