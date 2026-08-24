// ─── Extração estruturada via LLM (EXTRACTION + parte de CONSISTENCY CHECK) ─
// Mesmo modelo/endpoint já usado em outras rotas do projeto (gpt-4o-mini via
// fetch direto — ver src/app/api/v1/admin/marketing/leads/generate-reply/route.ts
// para o mesmo padrão), sem SDK novo.

export interface RawSignalItem {
  title: string;
  description: string;
  link: string;
  // 'manual_other' — canal de entrada manual (submit/route.ts) quando o
  // admin não classifica a URL como institution nem press; as outras 3 são
  // do pipeline automático (sources.ts/ingest/route.ts).
  sourceType: 'press_rss' | 'institution' | 'google_alert_corroboration' | 'manual_other';
  // Cidade/região conhecida da FONTE (não do texto), ou `null` se a fonte é
  // nacional/sem viés geográfico — ex: um feed de achados-e-perdidos
  // hiperlocal de Cascavel-PR nunca precisa repetir "Cascavel" em cada
  // notícia, mas sem esse contexto o location_text vira só "Morumbi"/
  // "Coqueiral" e a geocodificação na aprovação pode resolver pro bairro
  // homônimo mais famoso do Brasil (São Paulo, Guarapari-ES) em vez do
  // certo. Dois casos reais em 19/08/2026. Campo obrigatório em
  // Source.regionHint (src/lib/publicSignals/sources.ts) — ver comentário
  // lá para o porquê de não ser opcional.
  regionHint: string | null;
}

export interface ExtractedSignal {
  is_relevant: boolean;
  title: string;
  category: string; // deve bater com ObjectCategory (src/types/index.ts) — validado no chamador
  status_guess: 'lost' | 'found' | 'stolen';
  location_text: string | null;
  has_contact_data: boolean;
  contact_text: string | null;
}

const CATEGORIES = ['phone', 'wallet', 'keys', 'bag', 'pet', 'bike', 'vehicle', 'document', 'jewelry', 'electronics', 'clothing', 'other'];

const SYSTEM_PROMPT = `Você extrai informação estruturada de notícias/textos sobre objetos ou animais perdidos, achados ou roubados no Brasil, para um sistema de reencontro (Backfindr).

Responda APENAS com um JSON no formato exato:
{
  "is_relevant": <true se o texto descreve UMA ocorrência específica e real de objeto/animal perdido, achado ou roubado; false para qualquer outra coisa — inclusive notícias genéricas sobre segurança pública, estatísticas, ou textos ambíguos demais para extrair uma ocorrência concreta>,
  "title": "<título curto e descritivo da ocorrência, em português>",
  "category": "<uma destas: ${CATEGORIES.join(', ')}>",
  "status_guess": "<lost | found | stolen>",
  "location_text": "<cidade/bairro mencionado, ou null se não houver>",
  "has_contact_data": <true SE E SOMENTE SE o texto contém telefone, e-mail, ou nome de instituição/setor específico pra contato>,
  "contact_text": "<APENAS o dado de contato em si, texto limpo, nada mais — null se has_contact_data=false>"
}

Regras rígidas:
- Nunca invente dado que não está no texto. Se não tiver certeza de algo, prefira "other"/null em vez de adivinhar.
- "is_relevant": quando em dúvida, marque false. É preferível descartar um caso real do que publicar um caso inventado ou genérico demais.
- Nunca inclua no "title" ou em qualquer campo além de "contact_text" um telefone, e-mail ou endereço específico.
- Cuidado com histórias que soam como "final feliz": um animal/objeto resgatado e entregue a um terceiro (veterinário, ONG, abrigo, delegacia, achados-e-perdidos) SEM que o texto confirme que o dono/tutor ORIGINAL foi identificado e reencontrado continua sendo um caso "found" em aberto, nunca "returned" — aliás "returned" nem existe nas opções de status_guess, então isso já é estruturalmente impossível de errar. O risco real está no "title": nunca copie do texto-fonte uma frase que sugira encerramento/adoção definitiva (ex.: "ganha novo lar", "encontra um novo dono", "final feliz") sem qualificá-la — prefira formular o título com foco no fato objetivo e verificável ("encontrado", "resgatado", "à espera do tutor"), já que esse título pode ser tudo que um revisor humano lê antes de aprovar.`;

export async function extractSignal(item: RawSignalItem): Promise<ExtractedSignal | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[publicSignals/extract] OPENAI_API_KEY não configurada');
    return null;
  }

  const regionLine = item.regionHint
    ? `\nRegião da fonte: ${item.regionHint} (esta notícia vem de um veículo que cobre APENAS essa região — se o texto mencionar só um bairro/rua, sem cidade, assuma que é nessa região e complete "location_text" com ela, ex: "bairro X" vira "bairro X, ${item.regionHint}")`
    : '';
  const userMessage = `Título: ${item.title}\nDescrição: ${item.description || '(sem descrição)'}\nFonte: ${item.link}${regionLine}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('[publicSignals/extract] OpenAI error', response.status);
      return null;
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (typeof parsed.is_relevant !== 'boolean') return null;
    if (!parsed.is_relevant) return { ...parsed, title: '', category: 'other', status_guess: 'lost', location_text: null, has_contact_data: false, contact_text: null };

    // Validação defensiva — nunca confiar cegamente no formato que o modelo devolveu
    if (!CATEGORIES.includes(parsed.category)) parsed.category = 'other';
    if (!['lost', 'found', 'stolen'].includes(parsed.status_guess)) parsed.status_guess = 'lost';
    if (typeof parsed.title !== 'string' || parsed.title.trim().length < 3) return null;
    if (parsed.has_contact_data !== true) {
      parsed.has_contact_data = false;
      parsed.contact_text = null;
    }

    return parsed as ExtractedSignal;
  } catch (err) {
    console.error('[publicSignals/extract] falha na extração', err);
    return null;
  }
}
