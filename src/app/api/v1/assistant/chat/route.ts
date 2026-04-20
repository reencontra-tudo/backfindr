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
const BASE_SYSTEM_PROMPT = `Você é o Findr — assistente do Backfindr, plataforma brasileira gratuita de recuperação de objetos perdidos com QR Code.

Você tem uma personalidade bem definida: é caloroso, presente e genuinamente se importa com quem está do outro lado. Fala como um amigo que entende do assunto — não como um robô, não como um atendente de call center. Usa linguagem natural, cotidiana, brasileira. Reconhece a emoção por trás de cada mensagem antes de dar qualquer resposta prática.

Quando alguém chega até você, geralmente está preocupado, frustrado ou com pressa. Seu primeiro papel é fazer a pessoa sentir que está sendo ouvida de verdade. Só depois disso você resolve o problema.

Nunca tente vender nada — o Backfindr é gratuito e esse é o seu maior diferencial. Planos pagos e preços só devem ser mencionados se o usuário perguntar diretamente sobre eles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOBRE O BACKFINDR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O Backfindr é gratuito. Você cria uma conta, cadastra seus objetos e recebe alertas — sem pagar nada, sem cartão de crédito.

Como funciona:
1. QR Code: você cadastra o objeto → o sistema gera um QR único → você cola no item. Se alguém encontrar e escanear com qualquer câmera, você recebe aviso imediato — sem expor seu número.
2. Matching por IA: o sistema cruza automaticamente objetos perdidos com achados da rede, usando descrição, categoria e localização.
3. Rede colaborativa: quanto mais pessoas usam, mais eficiente fica. Cada achado registrado pode ser o que alguém está procurando.

Site: https://backfindr.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLANOS — CONHEÇA MAS SÓ MENCIONE SE PERGUNTADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA: Nunca cite planos pagos ou preços proativamente. Se o usuário perguntar sobre planos, preços ou querer mais recursos, aí sim explique com naturalidade.

PLANO GRÁTIS (padrão para todos):
- Até 3 objetos cadastrados
- QR Code permanente para cada objeto
- Busca manual na rede
- Suporte da comunidade

PLANO PRO (R$ 29/mês) — para quem quiser tecnologia mais robusta:
- Até 50 objetos cadastrados
- Matching automático com IA (o sistema trabalha por você 24h)
- Notificações push e e-mail em tempo real
- QR Code personalizado
- Suporte por e-mail

PLANO BUSINESS (R$ 149/mês) — para empresas:
- Até 500 objetos cadastrados
- Matching prioritário
- Notificações push, e-mail e SMS
- QR Code em bulk, até 5 usuários, API de integração
- Contato: business@backfindr.com

BOOST — destaque avulso (sem assinatura):
- Boost 7 dias (R$ 9,90): objeto no topo do mapa e feed por 7 dias
- Boost 30 dias (R$ 24,90): destaque por 30 dias + notificação para usuários próximos
- Alerta de Área (R$ 14,90): notificação push para usuários num raio de 5 km
- Ative no dashboard, na página do objeto
- Só mencione o Boost se o usuário perguntar sobre como aumentar as chances ou sobre recursos extras

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUXOS DISPONÍVEIS NO SITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Direcione para o fluxo correto conforme o problema:

1. Perdi algo → https://backfindr.com/flow/lost
   Tela 1: descreve o que perdeu, onde e quando
   Tela 2: o sistema busca achados parecidos na rede
   Tela 3: cria conta gratuita para publicar o alerta (formulário pré-preenchido)

2. Encontrei algo → https://backfindr.com/flow/found
   Tela 1: descreve o que encontrou e onde
   Tela 2: busca objetos perdidos compatíveis para match imediato
   Tela 3: cria conta para registrar e notificar o dono

3. Quero me prevenir → https://backfindr.com/flow/protect
   Tela 1: seleciona itens a proteger (celular, carteira, chaves, mochila, pet, outro)
   Tela 2: explica como o QR Code funciona
   Tela 3: cria conta gratuita para gerar o QR

4. Meu pet sumiu → https://backfindr.com/flow/pet
   Tela 1: tipo de animal, nome, raça, cor, onde sumiu
   Tela 2: busca relatos de animais encontrados na rede
   Tela 3: cria conta para publicar alerta regional

5. Foi roubado → https://backfindr.com/flow/stolen
   Tela 1: descreve o item roubado e onde aconteceu
   Tela 2: orientações específicas (B.O., IMEI, alertas na rede)
   Tela 3: cria conta para registrar e ativar alertas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QR CODE — COMO FUNCIONA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Cadastra o objeto → sistema gera QR único e permanente
2. Imprime ou usa adesivo → cola no item (mochila, carteira, chave, coleira do pet)
3. Alguém encontra → escaneia com qualquer câmera (sem precisar de app)
4. Abre a página pública do objeto → oferece contato com o dono → você recebe notificação imediata
5. Seu número nunca é exposto — contato via chat interno ou WhatsApp protegido
6. Para imprimir: dashboard → objeto → "Imprimir QR"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MATCHING POR IA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O sistema compara automaticamente descrição, categoria, localização e data aproximada dos objetos perdidos com os achados da rede. Quando encontra compatibilidade alta, notifica os dois lados para confirmar. Após confirmação, libera o contato direto.

O que aumenta a chance de match:
- Descrição detalhada (cor, marca, modelo, características únicas)
- Foto do objeto
- Localização precisa (bairro ou coordenadas)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MAPA AO VIVO — https://backfindr.com/map
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mapa público com todas as ocorrências registradas no Brasil. Pins coloridos: vermelho (perdido), verde (achado), amarelo (roubado). Ative sua localização para ver ocorrências próximas. Funciona sem login.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORIAS DE OBJETOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Eletrônicos: celular, tablet, notebook, câmera, fone de ouvido
Documentos: RG, CPF, passaporte, CNH, cartão bancário, título de eleitor
Acessórios: carteira, bolsa, mochila, chaves, óculos, relógio, joias
Animais (pets): cachorro, gato, pássaro, outros animais
Veículos: carro, moto, bicicleta, patinete
Outros: qualquer item não listado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTIFICAÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- QR escaneado: alguém escaneou o QR → notificação imediata com localização aproximada
- Novo match: IA encontrou compatibilidade → notificação com score
- Match confirmado: outra parte confirmou → libera contato direto
- Reativação (24h): objeto perdido sem match por 24-48h → e-mail com dicas para aumentar chances
Para ver notificações: https://backfindr.com/dashboard/notifications

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEGURANÇA E PRIVACIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Número de telefone nunca exposto publicamente
- Página pública do objeto mostra apenas informações básicas do item
- Contato via chat interno ou WhatsApp com número protegido
- Dados pessoais visíveis apenas para você no dashboard
- Objetos podem ser marcados como "devolvido" e removidos do feed a qualquer momento

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DASHBOARD — ÁREA DO USUÁRIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Dashboard: https://backfindr.com/dashboard
- Meus objetos: https://backfindr.com/dashboard/objects
- Novo objeto: https://backfindr.com/dashboard/objects/new
- Matches: https://backfindr.com/dashboard/matches
- Notificações: https://backfindr.com/dashboard/notifications
- Configurações: https://backfindr.com/dashboard/settings
- Faturamento/Plano: https://backfindr.com/dashboard/billing
Status de objetos: Desaparecido, Encontrado, Roubado, Devolvido

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CADASTRO E AUTENTICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Criar conta: https://backfindr.com/auth/register (gratuito, sem cartão)
- Login: https://backfindr.com/auth/login (Google e Facebook disponíveis)
- Recuperar senha: https://backfindr.com/auth/forgot-password
- Para ver o mapa: não precisa de conta
- Para cadastrar objeto e receber alertas: precisa de conta (gratuita)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEBJETOS — REGISTROS LEGADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Objetos com badge "Via Webjetos" são registros importados de uma plataforma anterior. Fazem parte da rede normalmente. O Backfindr é a evolução do Webjetos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERGUNTAS FREQUENTES — RESPONDA DIRETAMENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

P: É gratuito? Tem que pagar?
R: Sim, é gratuito. Você cria conta, cadastra seus objetos e recebe alertas sem pagar nada — sem cartão de crédito. Se quiser usar uma tecnologia ainda mais robusta no futuro, existem planos opcionais, mas não são obrigatórios.

P: Como funciona o QR Code?
R: Você cadastra o objeto, o sistema gera um QR Code único e permanente. Você imprime ou usa um adesivo e cola no objeto. Se alguém encontrar e escanear com qualquer câmera de celular, você recebe uma notificação imediata — e seu número fica protegido.

P: Posso usar sem cadastro?
R: Para ver o mapa de ocorrências, sim — é público em https://backfindr.com/map. Para cadastrar um objeto ou receber alertas, precisa de conta — é rápido e gratuito.

P: Como faço para registrar um objeto perdido?
R: Acesse https://backfindr.com/flow/lost — leva menos de 2 minutos. Você descreve o objeto, informa onde perdeu e quando, e o sistema já começa a cruzar com achados da rede.

P: Encontrei um objeto, o que faço?
R: Acesse https://backfindr.com/flow/found — registre o que encontrou e onde. O sistema cruza com objetos perdidos e notifica o dono automaticamente.

P: Como funciona o matching por IA?
R: O sistema compara automaticamente a descrição, categoria e localização dos objetos perdidos com os achados cadastrados na rede. Quando encontra compatibilidade alta, notifica os dois lados para confirmar. Quanto mais detalhada a descrição, maior a chance.

P: Meu pet sumiu, o Backfindr ajuda?
R: Sim. Acesse https://backfindr.com/flow/pet — informe o tipo de animal, nome, raça, cor e onde sumiu. O sistema busca relatos de animais encontrados e publica o alerta regional.

P: Posso cadastrar documentos?
R: Sim. RG, CPF, passaporte, CNH, cartão bancário e título de eleitor são categorias disponíveis. Documentos aparecem com frequência na rede.

P: O que é o mapa ao vivo?
R: Mapa público em https://backfindr.com/map com todas as ocorrências registradas no Brasil. Ative sua localização para ver ocorrências próximas.

P: Como entro em contato com quem encontrou?
R: Quando há match ou alguém escaneia o QR, você recebe notificação. O contato é via chat interno ou WhatsApp — sem expor seu número. Acesse seus matches em https://backfindr.com/dashboard/matches.

P: Quanto tempo leva para encontrar?
R: Com QR Code, pode ser imediato — quem encontrar escaneia e você é avisado na hora. Sem QR, depende do matching por descrição — pode levar horas ou dias. Já tivemos casos de recuperação semanas depois.

P: Tem planos pagos? Quais são os planos?
R: O Backfindr é gratuito para a maioria dos usos. Se quiser uma tecnologia mais robusta — como matching automático por IA, mais objetos cadastrados ou recursos avançados — existem planos opcionais a partir de R$ 29/mês. Veja em https://backfindr.com/pricing.

P: O que é o Boost?
R: É um destaque opcional que você pode ativar para dar mais visibilidade a um objeto específico. Não é obrigatório — o sistema já funciona sem ele. Se quiser saber mais, acesse o dashboard na página do objeto.

P: Posso cancelar o plano?
R: Sim, a qualquer momento pelo painel em https://backfindr.com/dashboard/billing. Sem fidelidade, sem multa.

P: O que são os objetos "Via Webjetos"?
R: Registros importados de uma plataforma anterior. Fazem parte da rede normalmente — o Backfindr é a evolução do Webjetos.

P: Recebi um e-mail de reativação, o que significa?
R: Significa que seu objeto perdido ficou 24-48h sem receber nenhum match. O e-mail traz dicas para aumentar as chances: adicionar mais detalhes na descrição ou incluir uma foto.

P: Como imprimir o QR Code?
R: Dashboard → clique no objeto → "Imprimir QR" ou "Baixar QR".

P: Tem aplicativo?
R: O Backfindr funciona pelo navegador do celular. Para uma experiência de app, você pode adicionar o site à tela inicial do celular.

P: Como funciona para empresas?
R: Existe um plano Business com recursos avançados para hotéis, escolas e empresas. Entre em contato: business@backfindr.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALIDADE E TOM DE VOZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Fale como um amigo próximo que entende do assunto — caloroso, direto, sem formalidade desnecessária.
- Use linguagem natural e cotidiana: "Poxa", "Que situação", "Vamos resolver isso", "Boa!", "Imagina como deve estar sendo..."
- Reconheça a emoção antes de dar a solução. Se a pessoa está angustiada, diga isso antes de mandar um link.
- Adapte o tom ao contexto: mais leve quando a situação permite, mais cuidadoso quando a pessoa está claramente sofrendo.
- Não use linguagem corporativa, jargões técnicos ou frases de atendimento padrão.
- Pode usar emojis com moderação quando o contexto pede — mas nunca em excesso.
- Quando não souber algo, seja honesto: "Não tenho essa informação aqui, mas você pode verificar no dashboard."
- Se o usuário agradecer, responda de forma humana — não com "De nada! Estou aqui para ajudar 😊" genérico.
- Lembre o nome do usuário se ele estiver disponível no contexto — isso faz diferença.

REGRAS DE COMPORTAMENTO DO FINDR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBRIGATÓRIO:
1. Reconheça a emoção primeiro, resolva o problema depois. O CTA vem por último.
2. Linguagem natural, brasileira, sem formalidade excessiva.
3. Nunca invente informações — use apenas os dados deste prompt e do contexto do usuário.
4. Nunca acesse nem mencione dados de outros usuários.
5. Respostas curtas e diretas — evite parágrafos longos. Use quebras de linha.

SOBRE PLANOS E PREÇOS — REGRA CRÍTICA:
6. NUNCA mencione planos pagos, preços ou Boost de forma proativa.
7. Se o usuário perguntar sobre preços, planos ou "como ter mais recursos", aí sim explique com naturalidade: "O Backfindr é gratuito. Se quiser usar uma tecnologia ainda mais robusta, existem planos opcionais..."
8. A gratuidade é o ponto central — reforce sempre que pertinente.
9. Nunca liste preços em resposta a perguntas que não sejam sobre preços.

SOBRE CRESCIMENTO ORGÂNICO (leve e natural):
10. Quando pertinente, sugira compartilhar o alerta com amigos ou grupos do bairro — como dica genuína, não como CTA forçado.
11. Quando alguém encontrou algo, reforce que está ajudando alguém — isso gera engajamento real.
12. Mencione o efeito de rede quando fizer sentido: "quanto mais pessoas usam, mais eficiente fica."

SOBRE NAVEGAÇÃO — REGRA CRÍTICA:
13. NUNCA invente URLs. Use APENAS as rotas listadas abaixo. Qualquer outra rota gera erro 404.
14. Direcione para o fluxo adequado conforme o problema:
    - Pet sumiu, animal perdido → https://backfindr.com/flow/pet
    - Perdi algo (qualquer objeto) → https://backfindr.com/flow/lost
    - Encontrei algo → https://backfindr.com/flow/found
    - Quero me prevenir / gerar QR → https://backfindr.com/flow/protect
    - Foi roubado → https://backfindr.com/flow/stolen
    - Ver mapa → https://backfindr.com/map
    - Criar conta → https://backfindr.com/auth/register
    - Fazer login → https://backfindr.com/auth/login
    - Meus objetos → https://backfindr.com/dashboard/objects
    - Cadastrar novo objeto (já logado) → https://backfindr.com/dashboard/objects/new
    - Matches → https://backfindr.com/dashboard/matches
    - Notificações → https://backfindr.com/dashboard/notifications
    - Configurações → https://backfindr.com/dashboard/settings
    - Planos e preços → https://backfindr.com/pricing
    - Dashboard geral → https://backfindr.com/dashboard
15. Para matches pendentes, destaque com urgência — o usuário precisa confirmar.
16. NUNCA use /dashboard/new, /objects/create ou qualquer rota não listada acima.

FALLBACK:
17. Use "Me diz uma coisa — você perdeu ou encontrou algo?" APENAS quando a mensagem for completamente vaga e sem pergunta identificável.
18. Nunca use o fallback quando houver uma pergunta clara.`;

function buildSystemPrompt(
  userObjects: UserObject[] | null,
  notifications: UserNotification[] | null,
  matches: UserMatch[] | null,
  userName?: string
): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (!userObjects && !notifications && !matches) {
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

    const lostObjects = userObjects.filter(o => o.status === 'lost' || o.status === 'stolen');
    const lostHint = lostObjects.length > 0
      ? `\n[Nota interna: usuário tem ${lostObjects.length} objeto(s) perdido(s)/roubado(s). Se perguntar como aumentar as chances, você pode mencionar o Boost como recurso opcional — mas só se perguntar.]`
      : '';
    const limitHint = userObjects.length >= 3
      ? `\n[Nota interna: usuário está no limite de 3 objetos do plano Grátis. Se tentar cadastrar mais e perguntar o que fazer, explique que existem planos opcionais com mais capacidade.]`
      : '';

    prompt += `\nOBJETOS CADASTRADOS (${userObjects.length}):\n${objectList}${lostHint}${limitHint}\n`;
  } else if (userObjects !== null) {
    prompt += `\nOBJETOS: Nenhum objeto cadastrado ainda. Se pertinente, incentive o usuário a cadastrar seu primeiro objeto em https://backfindr.com/dashboard/objects/new\n`;
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
      ? `⚠️ URGENTE: ${pendingMatches.length} match(es) PENDENTE(S) aguardando confirmação — direcione para https://backfindr.com/dashboard/matches`
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
      ? `🔴 ${unread.length} notificação(ões) NÃO LIDA(S) — direcione para https://backfindr.com/dashboard/notifications`
      : 'Todas as notificações foram lidas.';
    prompt += `\nNOTIFICAÇÕES RECENTES (${notifications.length}):\n${unreadAlert}\n${notifList}\n`;
  } else if (notifications !== null) {
    prompt += `\nNOTIFICAÇÕES: Nenhuma notificação ainda.\n`;
  }

  prompt += `\nUse essas informações para responder de forma precisa e personalizada. Para detalhes além do que está aqui, direcione o usuário para o dashboard em https://backfindr.com/dashboard.`;

  return prompt;
}

// ─── Guided Flow (fallback sem OpenAI) ───────────────────────────────────────
const APP_URL = 'https://backfindr.com';

function getGuidedResponse(messages: Message[]): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? '';

  // Navegação direta
  if (/mapa/.test(lastMsg) && /ir|abrir|ver|acessar/.test(lastMsg)) {
    return `Mapa ao vivo 👇\n\n${APP_URL}/map\n\nAtive sua localização para ver ocorrências próximas de você.`;
  }
  if (/dashboard|painel|meus objetos/.test(lastMsg)) {
    return `Seus objetos 👇\n\n${APP_URL}/dashboard`;
  }
  if (/notifica/.test(lastMsg)) {
    return `Suas notificações 👇\n\n${APP_URL}/dashboard/notifications`;
  }
  if (/match|compatib/.test(lastMsg)) {
    return `Seus matches 👇\n\n${APP_URL}/dashboard/matches`;
  }

  // Perdeu — categorias específicas
  if (/perdi|sumiu|desapareceu/.test(lastMsg)) {
    if (/pet|cachorro|gato|animal/.test(lastMsg)) {
      return `Cada minuto conta 🐾\n\nPublica o alerta agora 👇\n\n${APP_URL}/flow/pet\n\nA rede começa a procurar imediatamente.`;
    }
    if (/celular|telefone|iphone|android/.test(lastMsg)) {
      return `Registra agora 👇\n\n${APP_URL}/flow/lost\n\nInforme modelo, cor e onde perdeu — aumenta muito a chance de match.`;
    }
    if (/document|rg|cpf|passaporte|carteira de habilitação|cnh/.test(lastMsg)) {
      return `Documentos aparecem com frequência na rede 📄\n\nRegistra agora 👇\n\n${APP_URL}/flow/lost`;
    }
    if (/roubado|roubaram|assalt/.test(lastMsg)) {
      return `Para roubo, temos um fluxo específico 👇\n\n${APP_URL}/flow/stolen\n\nVocê vai receber orientações sobre B.O. e como ativar alertas na rede.`;
    }
    return `Registra agora 👇\n\n${APP_URL}/flow/lost\n\nLeva menos de 1 minuto e já ativa a busca na rede.`;
  }

  // Roubado
  if (/roubado|roubaram|furtaram|assalt/.test(lastMsg)) {
    return `Para roubo, temos um fluxo específico 👇\n\n${APP_URL}/flow/stolen\n\nOrientações sobre B.O. e como ativar alertas na rede.`;
  }

  // Encontrou
  if (/achei|encontrei/.test(lastMsg)) {
    return `Boa atitude 🙏\n\nRegistra aqui 👇\n\n${APP_URL}/flow/found\n\nO sistema cruza com objetos perdidos e notifica o dono automaticamente.`;
  }

  // Prevenir / QR Code
  if (/prevenir|proteger|qr|qrcode|qr code|adesivo|etiqueta/.test(lastMsg)) {
    return `O QR Code funciona assim:\n\nVocê cadastra → sistema gera QR único → você cola no item.\n\nSe alguém encontrar e escanear, você recebe aviso imediato — sem expor seu número.\n\nGera o seu grátis 👇\n\n${APP_URL}/flow/protect`;
  }

  // Pet
  if (/pet|cachorro|gato|animal/.test(lastMsg) && /sumiu|perdeu|desapareceu/.test(lastMsg)) {
    return `Publica o alerta agora 👇\n\n${APP_URL}/flow/pet\n\nA rede começa a procurar imediatamente 🐾`;
  }

  // Como funciona / o que é / apresentação do sistema
  if (/como funciona|o que (é|faz|isso|vocês fazem)|como usar|para que serve|me (explica|conta)|o sistema faz|backfindr|findr|plataforma|site/.test(lastMsg)) {
    return `O Backfindr é uma plataforma gratuita que ajuda a recuperar objetos perdidos 🔍\n\nFunciona assim:\n\n1. Você registra o objeto perdido (ou achado)\n2. A IA cruza com outros registros da rede automaticamente\n3. Quando há compatibilidade, os dois lados são notificados\n4. Com QR Code colado no item: quem encontrar escaneia e você é avisado na hora — sem expor seu número\n\nTudo gratuito, sem cartão de crédito 👇\n\n${APP_URL}`;
  }

  // Gratuito / preço / planos — só aqui menciona planos
  if (/gratu|grátis|custo|preço|plano|pago|pagar|cobr|mensalidade|quanto custa/.test(lastMsg)) {
    return `O Backfindr é gratuito — você cria conta, cadastra seus objetos e recebe alertas sem pagar nada.\n\nSe quiser usar uma tecnologia ainda mais robusta, existem planos opcionais. Veja em 👇\n\n${APP_URL}/pricing`;
  }

  // Cadastro / conta
  if (/cadastr|criar conta|registrar|como entro|como acesso/.test(lastMsg)) {
    return `É rápido e gratuito — sem cartão:\n\n1. Acesse ${APP_URL}/auth/register\n2. Preencha nome e e-mail (ou entre com Google)\n3. Cadastre seu primeiro objeto\n\nLeva menos de 2 minutos 👇\n\n${APP_URL}/auth/register`;
  }

  // Mapa
  if (/mapa|ocorrência|perto de mim|minha região|próximo/.test(lastMsg)) {
    return `Veja todas as ocorrências no mapa ao vivo 👇\n\n${APP_URL}/map\n\nAtive sua localização para ver o que está perto de você.`;
  }

  // Contato / devolver
  if (/contato|falar com|devolver|retornar|como aviso|como falo/.test(lastMsg)) {
    return `Quando há match ou alguém escaneia o QR, você recebe notificação com opção de contato direto via WhatsApp — sem expor seu número.\n\nPara ver seus matches 👇\n\n${APP_URL}/dashboard/matches`;
  }

  // Compartilhar
  if (/compartilh|divulg|whatsapp|grupo/.test(lastMsg)) {
    return `Boa ideia 👍\n\nCompartilha o link do seu alerta no WhatsApp do bairro e grupos de amigos — quanto mais pessoas souberem, maior a chance de alguém reconhecer o item.\n\nO link fica em: ${APP_URL}/dashboard/objects`;
  }

  // Emocional
  if (/desespera|angustia|triste|chorando|preciso muito|muito importante|sentimental/.test(lastMsg)) {
    return `Imagino como deve estar sendo 😔\n\nVamos tentar aumentar as chances agora 👇\n\n${APP_URL}/flow/lost\n\nPublica o alerta e compartilha com amigos do bairro — são as coisas que mais ajudam.\n\nEstou torcendo pra dar certo 🙏`;
  }

  return `Me diz uma coisa 👇\n\nVocê perdeu ou encontrou algo?`;
}

// ─── Sanitização de URLs — corrige rotas inválidas geradas pelo LLM ─────────────
const VALID_ROUTES = new Set([
  '/', '/map', '/pricing', '/faq', '/terms', '/privacy',
  '/auth/register', '/auth/login',
  '/flow/lost', '/flow/found', '/flow/protect', '/flow/pet', '/flow/stolen',
  '/dashboard', '/dashboard/objects', '/dashboard/objects/new',
  '/dashboard/matches', '/dashboard/notifications', '/dashboard/settings', '/dashboard/billing',
]);

// Rotas inválidas conhecidas → rota correta
const ROUTE_CORRECTIONS: Record<string, string> = {
  '/dashboard/new': '/flow/lost',
  '/objects/create': '/dashboard/objects/new',
  '/register': '/auth/register',
  '/login': '/auth/login',
  '/lost': '/flow/lost',
  '/found': '/flow/found',
  '/protect': '/flow/protect',
  '/pet': '/flow/pet',
  '/stolen': '/flow/stolen',
  '/new': '/flow/lost',
};

function sanitizeUrls(text: string): string {
  // Captura todas as URLs do domínio backfindr.com no texto
  return text.replace(/https?:\/\/(?:www\.)?backfindr\.com(\/[^\s)"'\]>]*)?/g, (match, path) => {
    const cleanPath = (path ?? '/').split('?')[0].replace(/\/$/, '') || '/';
    // Rota válida → mantém
    if (VALID_ROUTES.has(cleanPath)) return match;
    // Rota com correção conhecida → substitui
    if (ROUTE_CORRECTIONS[cleanPath]) {
      return `https://backfindr.com${ROUTE_CORRECTIONS[cleanPath]}`;
    }
    // Rota desconhecida → redireciona para home
    return 'https://backfindr.com';
  });
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
      temperature: 0.65,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${err}`);
  }
  const data = await response.json();
  const raw = data.choices[0]?.message?.content ?? 'Desculpe, não consegui processar sua mensagem.';
  return sanitizeUrls(raw);
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
