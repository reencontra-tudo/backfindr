export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
}
interface ChatRequest {
  messages: Message[];
  context?: { page?: string };
}
interface UserObject {
  title: string;
  status: string;
  category: string;
  created_at: string;
  qr_code: string;
  reward_amount: number | null;
  description: string | null;
}

// ─── System Prompt ────────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `Você é o Findr, assistente virtual do Backfindr — plataforma brasileira de recuperação de objetos perdidos com QR Code.

Você ajuda usuários a:
1. Cadastrar objetos perdidos, achados ou roubados
2. Entender como o sistema de matching por IA funciona
3. Navegar pela plataforma e tirar dúvidas
4. Escolher o plano ideal (Grátis, Pro ou Business)
5. Consultar o status dos seus próprios objetos cadastrados

Planos disponíveis:
- Grátis: 3 objetos, QR Code permanente, sem matching automático
- Pro (R$ 29/mês): 50 objetos, matching automático, notificações push
- Business (R$ 149/mês): objetos ilimitados, painel corporativo, API

Regras importantes:
- Seja empático, direto e use linguagem natural em português brasileiro
- Nunca invente informações sobre objetos ou usuários
- Se não souber algo, diga honestamente
- Quando o usuário perguntar sobre seus objetos, use APENAS os dados fornecidos no contexto abaixo
- Não acesse nem mencione dados de outros usuários`;

function buildSystemPrompt(userObjects: UserObject[] | null, userName?: string): string {
  let prompt = BASE_SYSTEM_PROMPT;
  if (userObjects && userObjects.length > 0) {
    const statusLabel: Record<string, string> = {
      lost: 'Desaparecido', found: 'Encontrado', stolen: 'Roubado', returned: 'Devolvido',
    };
    const objectList = userObjects.map((obj, i) => {
      const date = obj.created_at
        ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(obj.created_at))
        : 'data desconhecida';
      const reward = obj.reward_amount ? ` | Recompensa: R$ ${Number(obj.reward_amount).toFixed(2)}` : '';
      const status = statusLabel[obj.status] ?? obj.status;
      return `${i + 1}. "${obj.title}" — Status: ${status} | Cadastrado em: ${date} | Código QR: ${obj.qr_code}${reward}`;
    }).join('\n');
    const greeting = userName ? `O usuário logado chama-se ${userName}.` : 'O usuário está logado.';
    prompt += `\n\n─── CONTEXTO DO USUÁRIO LOGADO ───\n${greeting}\nEle possui ${userObjects.length} objeto(s) cadastrado(s):\n${objectList}\n\nUse essas informações para responder perguntas sobre os objetos dele de forma precisa e personalizada.`;
  } else if (userObjects !== null) {
    const greeting = userName ? `O usuário logado chama-se ${userName}.` : 'O usuário está logado.';
    prompt += `\n\n─── CONTEXTO DO USUÁRIO LOGADO ───\n${greeting}\nEle ainda não possui objetos cadastrados. Incentive-o a cadastrar seu primeiro objeto.`;
  }
  return prompt;
}

// ─── Guided Flow (fallback sem OpenAI) ───────────────────────────────────────
function getGuidedResponse(messages: Message[]): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? '';
  if (messages.length === 1) {
    return `Olá! Sou o **Findr**, seu assistente no Backfindr 👋\n\nPosso te ajudar com:\n• 📦 **Cadastrar** um objeto perdido ou achado\n• 🔍 **Entender** como o matching funciona\n• 💳 **Escolher** o plano ideal\n• ❓ **Tirar dúvidas** sobre a plataforma\n\nO que você precisa hoje?`;
  }
  if (/perdi|achei|cadastr|registr|roubaram/.test(lastMsg)) {
    return `Vamos registrar seu objeto agora!\n\n**Qual é o objeto?**\n(Ex: "Carteira preta de couro", "iPhone 14 azul")`;
  }
  if (/plano|preço|pagar|quanto custa/.test(lastMsg)) {
    return `Temos 3 planos:\n\n| Plano | Preço | Destaques |\n|---|---|---|\n| **Grátis** | R$ 0 | 3 objetos, QR Code |\n| **Pro** | R$ 29/mês | 50 objetos, matching IA |\n| **Business** | R$ 149/mês | Ilimitado, API |\n\nQuer saber mais sobre algum?`;
  }
  if (/qr|qrcode|etiqueta|codigo/.test(lastMsg)) {
    return `O **QR Code do Backfindr** é permanente:\n• Cada objeto recebe um código único\n• Quem encontrar escaneia e entra em contato\n• Sua identidade fica protegida\n\nQuer cadastrar um objeto?`;
  }
  return `Posso te ajudar! Acesse o **[Dashboard](https://backfindr.vercel.app/dashboard)** para gerenciar seus objetos ou me diga com mais detalhes o que precisa. 😊`;
}

// ─── OpenAI Integration ───────────────────────────────────────────────────────
async function getOpenAIResponse(messages: Message[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 600,
      temperature: 0.7,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${err}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content ?? 'Desculpe, não consegui processar sua mensagem.';
}

// ─── Buscar objetos do usuário no banco ───────────────────────────────────────
async function fetchUserObjects(userId: string): Promise<UserObject[]> {
  const result = await query(
    `SELECT title, status, category, created_at, qr_code, reward_amount, description
     FROM objects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return result.rows as UserObject[];
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Mensagens inválidas' }, { status: 400 });
    }

    // Autenticar usuário via JWT (opcional — chat funciona sem login)
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    const payload = token ? verifyToken(token) : null;

    let userObjects: UserObject[] | null = null;
    let userName: string | undefined;

    if (payload?.sub) {
      try {
        userObjects = await fetchUserObjects(payload.sub);
        const userResult = await query('SELECT name FROM users WHERE id = $1', [payload.sub]);
        userName = (userResult.rows[0] as { name: string } | undefined)?.name;
      } catch (err) {
        console.error('Erro ao buscar objetos do usuário para o Findr:', err);
        userObjects = [];
      }
    }

    const systemPrompt = buildSystemPrompt(userObjects, userName);

    let reply: string;
    if (process.env.OPENAI_API_KEY) {
      try {
        reply = await getOpenAIResponse(messages, systemPrompt);
      } catch (err) {
        console.error('OpenAI falhou, usando fluxo guiado:', err);
        reply = getGuidedResponse(messages);
      }
    } else {
      reply = getGuidedResponse(messages);
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Assistant chat error:', err);
    return NextResponse.json({ error: 'Erro interno do assistente' }, { status: 500 });
  }
}
