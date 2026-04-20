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

Sua missão é ajudar o usuário a resolver o problema dele de forma direta, empática e útil. Responda SEMPRE a pergunta que foi feita antes de redirecionar para qualquer link.

SOBRE O BACKFINDR:
- Plataforma gratuita de recuperação de objetos perdidos, achados e roubados
- Funciona com QR Code: você cola o QR no objeto → se alguém encontrar, escaneia → você recebe aviso imediato
- Sistema de matching por IA: cruza automaticamente objetos perdidos com achados da rede
- Mais de 500 ocorrências registradas no Brasil
- Site: https://backfindr.com

PLANOS:
- Grátis: até 3 objetos, QR Code permanente, busca manual
- Pro (R$ 29/mês): até 50 objetos, matching automático por IA, notificações push, prioridade no feed
- Business (R$ 149/mês): objetos ilimitados, painel corporativo, API de integração
- A maioria dos usuários resolve com o plano Grátis. Pro é indicado para quem tem muitos objetos ou quer matching automático.

COMO FUNCIONA (passo a passo):
1. Crie sua conta grátis em https://backfindr.com
2. Cadastre o objeto perdido, achado ou que quer proteger
3. O sistema gera um QR Code único para o objeto
4. Cole o QR no objeto (mochila, carteira, chave, pet, etc.)
5. Se alguém encontrar e escanear o QR, você recebe notificação imediata
6. A IA faz matching automático entre perdidos e achados da rede

FLUXOS DISPONÍVEIS NO SITE:
- Perdi algo → https://backfindr.com/flow/lost
- Encontrei algo → https://backfindr.com/flow/found
- Quero me prevenir → https://backfindr.com/flow/protect
- Meu pet sumiu → https://backfindr.com/flow/pet
- Foi roubado → https://backfindr.com/flow/stolen

FAQs — RESPONDA DIRETAMENTE QUANDO PERGUNTADO:

P: É gratuito? Tem que pagar?
R: Sim, é gratuito. O plano básico não tem custo. Você cria conta, cadastra objetos e recebe alertas sem pagar nada. Existe um plano Pro (R$ 29/mês) com recursos extras como matching automático, mas não é obrigatório.

P: Como funciona o QR Code?
R: Você cadastra o objeto, o sistema gera um QR Code único. Você imprime ou usa o adesivo e cola no objeto. Se alguém encontrar e escanear o QR com qualquer câmera de celular, você recebe um aviso imediato com a localização aproximada.

P: Posso usar sem fazer cadastro?
R: Para buscar objetos no mapa e ver ocorrências, sim. Para cadastrar um objeto ou receber alertas, precisa criar uma conta — é rápido e gratuito.

P: Como faço para registrar um objeto perdido?
R: Acesse https://backfindr.com/flow/lost — leva menos de 2 minutos. Você descreve o objeto, informa onde perdeu e o sistema já começa a cruzar com achados da rede.

P: Encontrei um objeto, o que faço?
R: Acesse https://backfindr.com/flow/found — registre o que encontrou e onde. O sistema cruza com os objetos perdidos e notifica o dono automaticamente.

P: Como funciona o matching por IA?
R: O sistema compara automaticamente a descrição, categoria e localização dos objetos perdidos com os achados cadastrados na rede. Quando encontra compatibilidade alta, notifica os dois lados para confirmar.

P: Meu pet sumiu, o Backfindr ajuda?
R: Sim. Acesse https://backfindr.com/flow/pet — registre as características do pet, foto e localização onde sumiu. O sistema alerta usuários da rede na mesma região.

P: Posso cadastrar documentos perdidos?
R: Sim. Documentos como RG, CPF, passaporte e carteira de habilitação são categorias disponíveis no cadastro.

P: O que é o mapa ao vivo?
R: É um mapa público em https://backfindr.com/map com todas as ocorrências registradas na rede. Você pode filtrar por tipo, status e localização. Ative sua localização para ver ocorrências próximas de você.

P: Como entro em contato com quem encontrou meu objeto?
R: Quando há um match ou alguém escaneia seu QR, você recebe uma notificação com opção de contato direto via WhatsApp ou mensagem interna — sem expor seu número publicamente.

P: Quanto tempo leva para encontrar o objeto?
R: Depende da rede na sua região. Objetos com QR Code têm chance maior de retorno imediato. Objetos sem QR dependem do matching por descrição — pode levar horas ou dias.

P: Posso cancelar o plano Pro?
R: Sim, a qualquer momento pelo painel em https://backfindr.com/dashboard.

REGRAS DE COMPORTAMENTO:
- SEMPRE responda a pergunta feita antes de redirecionar para um link
- Seja empático, direto e use linguagem natural em português brasileiro
- Nunca invente informações — use APENAS os dados do contexto fornecido
- Use o fallback "Me diz uma coisa — você perdeu ou encontrou algo?" APENAS quando a mensagem for completamente vaga e não tiver pergunta identificável
- Nunca use o fallback quando houver uma pergunta clara (preço, como funciona, cadastro, etc.)
- Nunca acesse nem mencione dados de outros usuários
- Links úteis:
  • Dashboard: https://backfindr.com/dashboard
  • Novo objeto: https://backfindr.com/dashboard/objects/new
  • Mapa: https://backfindr.com/map
  • Notificações: https://backfindr.com/dashboard?tab=notifications
  • Matches: https://backfindr.com/dashboard?tab=matches`;

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
const APP_URL = 'https://backfindr.com';

function getGuidedResponse(messages: Message[]): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? '';

  // Navegação
  if (/mapa/.test(lastMsg) && /ir|abrir|ver|acessar/.test(lastMsg)) {
    return `Mapa ao vivo 👇\n\n${APP_URL}/map`;
  }
  if (/dashboard|painel|meus objetos/.test(lastMsg)) {
    return `Seus objetos 👇\n\n${APP_URL}/dashboard`;
  }
  if (/notifica/.test(lastMsg)) {
    return `Suas notificações 👇\n\n${APP_URL}/dashboard?tab=notifications`;
  }
  if (/match|compatib/.test(lastMsg)) {
    return `Seus matches 👇\n\n${APP_URL}/dashboard?tab=matches`;
  }

  // Perdeu — categorias
  if (/perdi|sumiu|desapareceu|roubaram|furtaram/.test(lastMsg)) {
    if (/pet|cachorro|gato|animal/.test(lastMsg)) {
      return `Registra agora 👇\n\n${APP_URL}/dashboard/new\n\nQuanto antes, maior a chance de alguém te encontrar 🙏`;
    }
    if (/celular|telefone|iphone|android/.test(lastMsg)) {
      return `Registra agora 👇\n\n${APP_URL}/dashboard/new\n\nIsso já aumenta a chance de alguém te encontrar.`;
    }
    if (/carro|moto|veículo/.test(lastMsg)) {
      return `Registra agora 👇\n\n${APP_URL}/dashboard/new\n\nQuanto antes, mais rápido a rede pode ajudar.`;
    }
    if (/document|rg|cpf|passaporte|carteira/.test(lastMsg)) {
      return `Registra agora 👇\n\n${APP_URL}/dashboard/new\n\nDocumentos encontrados aparecem aqui com frequência.`;
    }
    return `Registra agora 👇\n\n${APP_URL}/dashboard/new\n\nLeva menos de 1 minuto e já ajuda bastante.`;
  }

  // Encontrou
  if (/achei|encontrei/.test(lastMsg)) {
    return `Boa atitude 🙏\n\nRegistra aqui 👇\n\n${APP_URL}/dashboard/new\n\nAssim o dono consegue te encontrar.`;
  }

  // Como funciona
  if (/como funciona|o que é|como usar/.test(lastMsg)) {
    return `É simples:\n\nvocê registra → alguém encontra → você recebe aviso\n\nFaz aqui 👇\n\n${APP_URL}`;
  }

  // Gratuito / preço / planos
  if (/gratu|grátis|custo|preço|plano|pago|pagar|cobr|mensalidade/.test(lastMsg)) {
    return `É gratuito — o plano básico não tem custo.\n\nVocê cria conta, cadastra objetos e recebe alertas sem pagar nada.\n\nExiste um plano Pro (R$ 29/mês) com matching automático por IA e notificações push, mas não é obrigatório.\n\nCria sua conta grátis aqui 👇\n\n${APP_URL}`;
  }

  // QR Code
  if (/qr|qrcode|qr code|adesivo|etiqueta/.test(lastMsg)) {
    return `O QR Code funciona assim:\n\nVocê cadastra o objeto → o sistema gera um QR único → você cola no objeto.\n\nSe alguém encontrar e escanear com qualquer câmera, você recebe aviso imediato com a localização.\n\nCria o seu QR grátis aqui 👇\n\n${APP_URL}`;
  }

  // Cadastro / conta
  if (/cadastr|criar conta|registrar|como entro|como acesso/.test(lastMsg)) {
    return `É rápido e gratuito:\n\n1. Acesse ${APP_URL}\n2. Clique em "Criar QR grátis"\n3. Preencha nome e e-mail\n4. Cadastre seu primeiro objeto\n\nLeva menos de 2 minutos 👇\n\n${APP_URL}`;
  }

  // Mapa
  if (/mapa|ocorrência|perto de mim|minha região/.test(lastMsg)) {
    return `Veja todas as ocorrências registradas no mapa ao vivo 👇\n\n${APP_URL}/map\n\nAtive sua localização para ver o que está perto de você.`;
  }

  // Contato / devolver
  if (/contato|falar com|devolver|retornar|como aviso/.test(lastMsg)) {
    return `Quando há um match ou alguém escaneia o QR, você recebe notificação com opção de contato direto via WhatsApp — sem expor seu número publicamente.\n\nPara ver seus matches 👇\n\n${APP_URL}/dashboard?tab=matches`;
  }

  // Emocional
  if (/desespera|angustia|triste|chorando|preciso muito/.test(lastMsg)) {
    return `Imagino como deve estar sendo 😔\n\nVamos tentar aumentar as chances 👇\n\n${APP_URL}\n\nEstou torcendo pra dar certo 🙏`;
  }

  return `Me diz uma coisa 👇\n\nVocê perdeu ou encontrou algo?`;
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
