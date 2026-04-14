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
interface UserNotification {
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}
interface UserMatch {
  id: string;
  score: number;
  status: string;
  created_at: string;
  lost_title: string;
  found_title: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `Você é o Findr, assistente virtual do Backfindr — plataforma brasileira de recuperação de objetos perdidos com QR Code.

Você ajuda usuários a:
1. Cadastrar objetos perdidos, achados ou roubados
2. Entender como o sistema de matching por IA funciona
3. Navegar pela plataforma e tirar dúvidas
4. Escolher o plano ideal (Grátis, Pro ou Business)
5. Consultar notificações, matches e status dos objetos do usuário logado

Planos disponíveis:
- Grátis: 3 objetos, QR Code permanente, sem matching automático
- Pro (R$ 29/mês): 50 objetos, matching automático, notificações push
- Business (R$ 149/mês): objetos ilimitados, painel corporativo, API

REGRAS DE COMPORTAMENTO:
- Seja empático, direto e use linguagem natural em português brasileiro
- Nunca invente informações — use APENAS os dados do contexto fornecido
- Se não tiver uma informação específica, direcione o usuário para a ação correta no dashboard em vez de simplesmente dizer "não sei"
- Quando não souber algo, use estas respostas de fallback:
  • Para ver detalhes completos de um objeto → "Acesse seu [Dashboard](https://backfindr.vercel.app/dashboard)"
  • Para ver todas as notificações → "Veja suas [Notificações](https://backfindr.vercel.app/dashboard?tab=notifications)"
  • Para ver matches → "Confira seus [Matches](https://backfindr.vercel.app/dashboard?tab=matches)"
  • Para cadastrar um objeto → "Cadastre agora em [Novo Objeto](https://backfindr.vercel.app/dashboard/new)"
  • Para ver o mapa → "Explore o [Mapa](https://backfindr.vercel.app/map)"
- Nunca acesse nem mencione dados de outros usuários`;

function buildSystemPrompt(
  userObjects: UserObject[] | null,
  notifications: UserNotification[] | null,
  matches: UserMatch[] | null,
  userName?: string
): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (!userObjects && !notifications && !matches) {
    // Usuário não logado — sem contexto pessoal
    return prompt;
  }

  const greeting = userName ? `O usuário logado chama-se ${userName}.` : 'O usuário está logado.';
  prompt += `\n\n═══ CONTEXTO PESSOAL DO USUÁRIO ═══\n${greeting}\n`;

  // ── Objetos ──
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
      return `  ${i + 1}. "${obj.title}" — ${status} | Cadastrado: ${date} | QR: ${obj.qr_code}${reward}`;
    }).join('\n');
    prompt += `\nOBJETOS CADASTRADOS (${userObjects.length}):\n${objectList}\n`;
  } else if (userObjects !== null) {
    prompt += `\nOBJETOS: Nenhum objeto cadastrado ainda. Incentive o usuário a cadastrar seu primeiro objeto.\n`;
  }

  // ── Matches ──
  if (matches && matches.length > 0) {
    const matchStatusLabel: Record<string, string> = {
      pending: 'Aguardando confirmação',
      confirmed: 'Confirmado',
      rejected: 'Descartado',
      completed: 'Concluído',
    };
    const pendingMatches = matches.filter(m => m.status === 'pending');
    const matchList = matches.slice(0, 5).map((m, i) => {
      const date = m.created_at
        ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(m.created_at))
        : '';
      const status = matchStatusLabel[m.status] ?? m.status;
      const score = Math.round(m.score * 100);
      return `  ${i + 1}. "${m.lost_title}" ↔ "${m.found_title}" | ${score}% compatibilidade | ${status} | ${date}`;
    }).join('\n');
    const pendingAlert = pendingMatches.length > 0
      ? `⚠️ ATENÇÃO: ${pendingMatches.length} match(es) PENDENTE(S) aguardando confirmação do usuário!`
      : '';
    prompt += `\nMATCHES (${matches.length} total):\n${pendingAlert ? pendingAlert + '\n' : ''}${matchList}\n`;
  } else if (matches !== null) {
    prompt += `\nMATCHES: Nenhum match encontrado ainda.\n`;
  }

  // ── Notificações ──
  if (notifications && notifications.length > 0) {
    const unread = notifications.filter(n => !n.read);
    const notifList = notifications.slice(0, 5).map((n, i) => {
      const date = n.created_at
        ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(n.created_at))
        : '';
      const readMark = n.read ? '✓' : '🔴';
      return `  ${i + 1}. ${readMark} [${n.type}] ${n.title}: ${n.message} | ${date}`;
    }).join('\n');
    const unreadAlert = unread.length > 0
      ? `🔴 ${unread.length} notificação(ões) NÃO LIDA(S)!`
      : 'Todas as notificações foram lidas.';
    prompt += `\nNOTIFICAÇÕES RECENTES (${notifications.length}):\n${unreadAlert}\n${notifList}\n`;
  } else if (notifications !== null) {
    prompt += `\nNOTIFICAÇÕES: Nenhuma notificação ainda.\n`;
  }

  prompt += `\nUse essas informações para responder de forma precisa e personalizada. Para detalhes além do que está aqui, direcione o usuário para o dashboard.`;

  return prompt;
}

// ─── Guided Flow (fallback sem OpenAI) ───────────────────────────────────────
function getGuidedResponse(messages: Message[]): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? '';
  if (messages.length === 1) {
    return `Olá! Sou o **Findr**, seu assistente no Backfindr 👋\n\nPosso te ajudar com:\n• 📦 **Cadastrar** um objeto perdido ou achado\n• 🔔 **Verificar** notificações e matches\n• 🔍 **Entender** como o matching funciona\n• ❓ **Tirar dúvidas** sobre a plataforma\n\nO que você precisa hoje?`;
  }
  if (/notifica|novidade|atualiza|aconteceu/.test(lastMsg)) {
    return `Para ver suas notificações mais recentes, acesse:\n👉 **[Notificações no Dashboard](https://backfindr.vercel.app/dashboard?tab=notifications)**`;
  }
  if (/match|compatib|encontrou|achou/.test(lastMsg)) {
    return `Para ver seus matches, acesse:\n👉 **[Matches no Dashboard](https://backfindr.vercel.app/dashboard?tab=matches)**`;
  }
  if (/perdi|achei|cadastr|registr|roubaram/.test(lastMsg)) {
    return `Vamos registrar seu objeto agora!\n👉 **[Cadastrar objeto](https://backfindr.vercel.app/dashboard/new)**\n\nOu me diga o que perdeu e eu te ajudo a descrever melhor.`;
  }
  if (/plano|preço|pagar|quanto custa/.test(lastMsg)) {
    return `Temos 3 planos:\n\n| Plano | Preço | Destaques |\n|---|---|---|\n| **Grátis** | R$ 0 | 3 objetos, QR Code |\n| **Pro** | R$ 29/mês | 50 objetos, matching IA |\n| **Business** | R$ 149/mês | Ilimitado, API |\n\nQuer saber mais sobre algum?`;
  }
  return `Posso te ajudar! Acesse o **[Dashboard](https://backfindr.vercel.app/dashboard)** para gerenciar seus objetos, ou me diga com mais detalhes o que precisa. 😊`;
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
      max_tokens: 700,
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

// ─── Buscar dados do usuário no banco ────────────────────────────────────────
async function fetchUserData(userId: string) {
  const [objectsResult, notifResult, matchResult, userResult] = await Promise.all([
    query(
      `SELECT title, status, category, created_at, qr_code, reward_amount, description
       FROM objects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    ),
    query(
      `SELECT title, message, type, read, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    ),
    query(
      `SELECT m.id, m.score, m.status, m.created_at,
              lo.title as lost_title, fo.title as found_title
       FROM matches m
       LEFT JOIN objects lo ON m.lost_object_id = lo.id
       LEFT JOIN objects fo ON m.found_object_id = fo.id
       WHERE lo.user_id = $1 OR fo.user_id = $1
       ORDER BY m.created_at DESC LIMIT 10`,
      [userId]
    ),
    query('SELECT name FROM users WHERE id = $1', [userId]),
  ]);

  return {
    objects: objectsResult.rows as UserObject[],
    notifications: notifResult.rows as UserNotification[],
    matches: matchResult.rows as UserMatch[],
    userName: (userResult.rows[0] as { name: string } | undefined)?.name,
  };
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

    let objects: UserObject[] | null = null;
    let notifications: UserNotification[] | null = null;
    let matches: UserMatch[] | null = null;
    let userName: string | undefined;

    if (payload?.sub) {
      try {
        const data = await fetchUserData(payload.sub);
        objects = data.objects;
        notifications = data.notifications;
        matches = data.matches;
        userName = data.userName;
      } catch (err) {
        console.error('Erro ao buscar dados do usuário para o Findr:', err);
        objects = [];
        notifications = [];
        matches = [];
      }
    }

    const systemPrompt = buildSystemPrompt(objects, notifications, matches, userName);

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
