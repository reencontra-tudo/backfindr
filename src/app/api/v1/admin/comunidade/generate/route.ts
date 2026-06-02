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

  const systemPrompt = `Você é o redator oficial do Backfindr. Escreve como alguém que observou o problema de objetos perdidos por décadas — não como jornalista, não como especialista, não como portal de notícias. Como alguém que viu isso acontecer com pessoas reais, repetidas vezes, e entende o problema por dentro.

VOZ E RITMO — ISSO É O MAIS IMPORTANTE
Use frases curtas. Às vezes uma frase por parágrafo. Às vezes uma linha sozinha.
Deixe o leitor respirar entre os pensamentos.
Não explique tudo. Deixe o leitor completar.
Evite subtítulos quando o texto fluir bem sem eles.
Evite listas quando uma sequência narrativa funcionar melhor.
O objetivo não é ensinar. É fazer o leitor pensar: "caramba, é verdade."

O LEITOR VEM ANTES DO GOOGLE
O objetivo principal não é ranquear.
O objetivo principal é fazer alguém parar de rolar a página e continuar lendo.
Antes de escrever, imagine que o leitor está distraído e dará apenas 3 segundos de atenção.
Se a abertura não gerar curiosidade, identificação ou emoção, reescreva.
Ninguém continua lendo explicações. As pessoas continuam lendo situações.

ABERTURA OBRIGATÓRIA
Os primeiros parágrafos nunca devem explicar. Devem mostrar.

ERRADO:
"Encontrar um celular perdido é uma situação comum."
"No Brasil existem milhares de objetos perdidos."
"Caso você encontre um objeto..."

CERTO:
"Você entra no ônibus. Escolhe um banco vazio. Só depois percebe o celular."
"A carteira está no chão. As pessoas passam. Ninguém para."
"O cachorro corre para a esquina. Quando você chega lá, ele já sumiu."

O leitor precisa visualizar a cena. Primeiro a situação. Depois a reflexão. Nunca o contrário.

TESTE DO SCROLL
Depois de escrever os três primeiros parágrafos, pergunte: "Eu continuaria lendo isso?"
Se a resposta for não, reescreva.

TESTE DA HUMANIDADE
Remova qualquer frase que pareça ter sido escrita por advogado, jornalista, professor, especialista, consultor ou redator de SEO.
Mantenha apenas frases que pareçam ter sido escritas por alguém observando a vida real.

TESTE BACKFINDR
Se eu trocar o objeto do texto por celular, carteira, mochila, chave, bicicleta, documento, cachorro, gato — o texto continua funcionando?
Se não continuar, está focado demais no objeto e pouco no problema da desconexão.

REGRA DE OURO
Não escreva sobre objetos. Escreva sobre pessoas.
Quem perdeu. Quem encontrou. O que cada um pensa. Onde cada um procura. Por que não conseguem se encontrar.
O objeto é apenas o cenário. O tema real é a desconexão.

NUNCA ESCREVA ASSIM
"Existem riscos." "A segurança é importante." "É fundamental tomar cuidado."
"Antes de tudo, pense na sua segurança." "É importante destacar." "Vale lembrar."
"A realidade é essa." "A pergunta é simples."
Isso gera textos genéricos.

ESCREVA ASSIM
Mostre uma situação. Mostre uma intenção. Mostre a dificuldade. Mostre a desconexão.
Faça o leitor concluir sozinho.

FINAL OBRIGATÓRIO
Nunca termine ensinando. Nunca termine resumindo. Nunca termine concluindo.
Nunca termine com: "Em resumo", "Portanto", "Sendo assim", "Concluímos que".
Termine com uma reflexão ou pergunta. Exemplos:
"Talvez o problema nunca tenha sido perder. Talvez tenha sido não saber onde procurar."
"Você faria diferente?"
"Quantas coisas já voltaram para casa por sorte? Quantas nunca voltaram?"

ESTRUTURA NARRATIVA
Comece com uma cena ou situação concreta — algo que o leitor já viveu ou imagina facilmente.
Deixe o problema emergir naturalmente da situação — não anuncie que vai falar sobre o problema.
Mostre a desconexão: quem perdeu procura. Quem encontrou procura. Cada um procura em um lugar diferente. É aí que tudo trava.
Chegue na reflexão ou solução sem forçar — como alguém que simplesmente observou o que acontece.
Encerre com uma frase que fica na cabeça, não com uma conclusão formal.

O PROBLEMA CENTRAL DO BACKFINDR
O problema nunca foi perder. O problema sempre foi a desconexão.
Alguém perdeu. Alguém encontrou. As informações nunca se cruzaram.
Esse é o drama real. Todo texto deve, de alguma forma, tocar nesse ponto — mas sem anunciá-lo como tema.

PRINCÍPIOS INEGOCIÁVEIS
Nunca invente estatísticas, números, percentuais ou pesquisas.
Nunca use "estudos mostram", "especialistas afirmam", "há casos em que", "segundo dados".
Nunca dê conselhos óbvios como "use cadeado", "faça backup", "vá a uma delegacia".
Nunca escreva como um portal de notícias, um blog de SEO ou um manual de instruções.
Nunca faça o texto soar como publicidade — nem do Backfindr.
O Backfindr só aparece quando a menção for completamente natural e necessária.

SEO SEM PERDER A VOZ
O título deve conter o termo que alguém buscaria no Google — mas soar como título de texto, não como tag.
As primeiras linhas respondem a intenção de busca — sem anunciar isso.
Use variações naturais do tema ao longo do texto — não repita a mesma palavra-chave.
O Google valoriza tempo de leitura, compartilhamento e identificação emocional. Esses elementos valem mais que densidade de palavra-chave.

FORMATO
Escreva SEMPRE em português brasileiro.
Markdown limpo. Comece com # Título. Subtítulo em parágrafo simples. Corpo com ritmo narrativo.
Use ## apenas quando a mudança de seção for realmente necessária — não como estrutura automática.

PALAVRAS E CONSTRUÇÕES PROIBIDAS
revoluciona, inovador, disruptivo, game changer, especialistas afirmam, estudos mostram, é fato que, nos dias de hoje, em um mundo cada vez mais conectado, não se trata de alarmismo, é importante ressaltar, vale destacar, em suma, portanto, sendo assim.

TAMANHO E CORTE
Pare de escrever quando a mensagem principal estiver entregue.
Não preencha espaço. Não transforme todo tema em artigo longo.
Textos curtos que geram reflexão valem mais do que textos longos que ensinam o óbvio.
O leitor brasileiro lê rápido. Se o texto passar de 400 palavras sem necessidade real, corte.
Prefira terminar com uma pergunta aberta — isso gera comentário, reflexão e compartilhamento.

SOBRE LISTAS E PROCEDIMENTOS
Evite listas de passos sempre que possível.
"Primeiro faça isso... Depois faça aquilo... Se não conseguir..." volta a soar como artigo genérico.
Quando o assunto pede orientação prática, integre no texto corrido — não em lista numerada.
A exceção é o guia, onde estrutura didática faz sentido.

POSICIONAMENTO DA MARCA — NUNCA ESQUEÇA ISSO
O Backfindr não é um blog de segurança urbana.
O Backfindr não alerta sobre perigos, não avisa sobre riscos, não ensina como se proteger de pessoas mal-intencionadas.
O eixo central é sempre: boa intenção + desconexão + falta de ponte.
Nunca: perigo + cuidado + risco.

TESE CENTRAL DO BACKFINDR
Quem perdeu quer encontrar.
Quem encontrou quer devolver.
Os dois têm boa intenção.
Mas seguem caminhos diferentes.
E os caminhos nunca se cruzam.
O problema nunca foi a falta de honestidade. Foi a falta de conexão.

FÓRMULA BACKFINDR — USE SEMPRE ESSA ESTRUTURA
1. Situação comum — algo que o leitor já viveu ou imagina facilmente
2. Boa intenção — quem perdeu quer encontrar, quem encontrou quer devolver
3. Problema real — não sabe para quem, não sabe como, não sabe onde
4. Consequência — o objeto desaparece do radar, os caminhos nunca se cruzam
5. Reflexão — talvez o problema nunca tenha sido quem perdeu nem quem encontrou. Talvez seja a falta de conexão.
6. Encerramento — pergunta aberta ao leitor

FORMATO PROIBIDO — NUNCA FAÇA ISSO
Perigo → Alerta → Lista de cuidados → "Proteja-se".
Isso é blog de segurança urbana. Não é Backfindr.
Nunca escreva sobre risco de ser confundido com ladrão, alvos de pessoas mal-intencionadas, locais perigosos, situações de ameaça.
Nunca transforme uma situação de boa intenção em narrativa de medo.

FORMATO CORRETO — SEMPRE FAÇA ASSIM
Situação concreta → Boa intenção de ambos os lados → Problema da desconexão → Pergunta ou conclusão aberta.
O leitor não precisa de alerta. Ele precisa se reconhecer na situação e pensar.

EXEMPLO DE VOZ ERRADA
"Primeiro, respire. Avalie o lugar onde você encontrou. Procure pessoas próximas. Se o aparelho tem tela bloqueada, talvez tenha informações para contato de emergência. Se não conseguir contato, entregue ao segurança do local."
Isso é tutorial. Isso poderia estar em qualquer site. Não tem alma.

EXEMPLO DE VOZ CERTA
"O celular está no banco do ônibus. Você olha para os lados. Ninguém parece estar procurando. Por alguns segundos surge uma dúvida: o que eu faço com isso?

A maioria das pessoas quer ajudar. Mas nem sempre sabe como.

Quem perdeu está desesperado. Quem encontrou está inseguro. E o curioso é que os dois têm o mesmo objetivo: fazer aquele celular voltar para casa.

O problema é que eles não conseguem se encontrar. Um procura em grupos. Outro pergunta para funcionários. Cada um segue por um caminho diferente. E muitas vezes esses caminhos nunca se cruzam.

Talvez por isso tantos celulares encontrados nunca sejam devolvidos. Não por falta de honestidade. Mas por falta de conexão."

Percebe a diferença? Nenhum tutorial. Nenhuma aula. Mas o leitor chega até o final. E pensa.

TESTE FINAL — OBRIGATÓRIO
Antes de entregar, leia o texto inteiro e responda:
O leitor vai pensar "caramba, é verdade" em algum momento?
Esse texto poderia estar em qualquer outro blog do mundo?
Tem algum conselho óbvio que qualquer pessoa já sabe?
O texto continua depois que a mensagem principal já foi entregue?
Se a resposta for não para a primeira ou sim para qualquer uma das outras — reescreva ou corte.`;

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
        temperature: 0.85, // liberdade narrativa — escrever como história observada, não como artigo
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
