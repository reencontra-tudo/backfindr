import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json() as { rede?: string; texto?: string; tipoItem?: string; cidade?: string; flowLink?: string };
    const { rede, texto, tipoItem, cidade, flowLink } = body;

    if (!rede || !texto) {
      return NextResponse.json({ detail: 'rede e texto são obrigatórios' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ detail: 'OPENAI_API_KEY não configurada' }, { status: 503 });

    const redeLabels: Record<string, string> = {
      facebook: 'Facebook', instagram: 'Instagram', twitter: 'Twitter/X', reddit: 'Reddit', tiktok: 'TikTok',
    };

    const systemPrompt = `Você é um assistente de growth do Backfindr, plataforma brasileira de achados e perdidos.
Gere UMA resposta curta (2-3 linhas) para comentar em posts onde alguém perdeu algo.
Regras:
- Tom humano e empático, nunca pareça robô ou spam
- Mencione o Backfindr e o link backfindr.com de forma natural
- Reddit: mais útil e informativo. Twitter: mais direto. Facebook/Instagram: mais caloroso
- Máximo 1-2 emojis
- Varie sempre a estrutura, nunca repita o mesmo formato
Responda APENAS com o texto do comentário. Sem aspas. Sem explicações.`;

    const userMessage = `Plataforma: ${redeLabels[rede] ?? rede}
Texto do post: "${texto}"
Item perdido: ${tipoItem || 'não especificado'}
Cidade: ${cidade || 'não informada'}
Link de cadastro: ${flowLink || 'https://backfindr.com'}
IMPORTANTE: Use APENAS a URL curta "backfindr.com" na resposta, nunca URLs longas com parâmetros.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[generate-reply] OpenAI error:', err);
      return NextResponse.json({ detail: 'Erro na API OpenAI' }, { status: 502 });
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const reply = data.choices[0]?.message?.content ?? 'Erro ao gerar resposta.';
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[marketing/leads/generate-reply POST]', error);
    return NextResponse.json({ detail: 'Erro ao gerar reply com IA' }, { status: 500 });
  }
}
