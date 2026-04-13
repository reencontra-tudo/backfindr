export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: Message[];
  context?: {
    page?: string;
    userId?: string;
    userPlan?: string;
  };
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o Findr, assistente virtual do Backfindr — plataforma brasileira de recuperação de objetos perdidos.

Você ajuda usuários a:
1. Cadastrar objetos perdidos ou achados de forma eficiente
2. Entender como o sistema de matching por IA funciona
3. Navegar pela plataforma e tirar dúvidas
4. Escolher o plano ideal (Grátis, Pro ou Business)

Quando o usuário quiser cadastrar um objeto, conduza uma conversa natural para coletar:
- Título do objeto (ex: "Carteira preta de couro")
- Tipo: perdido, achado, roubado
- Categoria: phone, wallet, keys, bag, pet, bike, document, jewelry, electronics, clothing, other
- Descrição detalhada (cor, marca, características únicas)
- Local onde foi perdido/achado (cidade, bairro, ponto de referência)
- Data aproximada

Ao final, confirme os dados e informe que o objeto será cadastrado.

Seja sempre empático, direto e use linguagem natural em português brasileiro.
Nunca invente informações sobre objetos ou usuários.
Se não souber algo, diga honestamente.

Planos disponíveis:
- Grátis: 3 objetos, sem matching automático
- Pro (R$29/mês): 50 objetos, matching automático, notificações
- Business (R$149/mês): objetos ilimitados, painel corporativo, API`;

// ─── Guided Flow (sem OpenAI) ─────────────────────────────────────────────────

function getGuidedResponse(messages: Message[], context?: ChatRequest['context']): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? '';
  const history = messages.map(m => m.content.toLowerCase()).join(' ');

  // Saudação inicial
  if (messages.length === 1) {
    return `Olá! Sou o **Findr**, seu assistente no Backfindr 👋

Posso te ajudar com:
• 📦 **Cadastrar** um objeto perdido ou achado
• 🔍 **Entender** como o matching funciona
• 💳 **Escolher** o plano ideal
• ❓ **Tirar dúvidas** sobre a plataforma

O que você precisa hoje?`;
  }

  // Intenção de cadastrar
  if (/perdi|achei|cadastr|registr|perder|achar|roubaram|furtar|stolen|lost|found/.test(lastMsg)) {
    if (/perdi|perder|lost/.test(lastMsg)) {
      return `Que situação difícil! Vamos cadastrar seu objeto perdido agora para aumentar as chances de recuperação 🎯

**Qual é o objeto que você perdeu?**
(Ex: "Carteira preta de couro", "iPhone 14 azul", "Chaves com chaveiro de cachorro")`;
    }
    if (/achei|achar|found/.test(lastMsg)) {
      return `Que atitude incrível! Vamos registrar o objeto achado para devolvê-lo ao dono 🤝

**O que você encontrou?**
(Ex: "Óculos de grau", "Mochila preta", "Carteira com documentos")`;
    }
    if (/roubaram|furtar|stolen/.test(lastMsg)) {
      return `Lamentamos muito! Vamos registrar o objeto roubado — isso pode ajudar na recuperação caso ele apareça no sistema 🔒

**Qual objeto foi roubado?**
(Ex: "Notebook Dell preto", "Bicicleta Trek azul")`;
    }
    return `Entendido! Vamos cadastrar seu objeto.

**Qual é o objeto?**
(Descreva brevemente: tipo, cor, marca se souber)`;
  }

  // Perguntas sobre planos
  if (/plano|preço|preco|pagar|assinar|pro|business|gratis|gratuito|quanto custa/.test(lastMsg)) {
    return `Temos 3 planos disponíveis:

| Plano | Preço | Destaques |
|-------|-------|-----------|
| **Grátis** | R$ 0 | 3 objetos, QR Code permanente |
| **Pro** | R$ 29/mês | 50 objetos, matching automático, notificações |
| **Business** | R$ 149/mês | Ilimitado, painel corporativo, API |

Para a maioria das pessoas, o **Plano Pro** é o mais indicado — o matching automático por IA aumenta muito as chances de recuperação.

Quer saber mais sobre algum plano específico?`;
  }

  // Perguntas sobre matching
  if (/matching|como funciona|ia|inteligencia|algoritmo|encontrar|recuperar/.test(lastMsg)) {
    return `O **matching por IA** do Backfindr funciona assim:

1. **Você cadastra** o objeto perdido com descrição detalhada
2. **Alguém acha** um objeto e cadastra no sistema
3. **Nossa IA compara** automaticamente os dois cadastros usando:
   - Similaridade de descrição
   - Proximidade geográfica (raio de 50km)
   - Período de tempo
4. **Você recebe uma notificação** quando há um match provável
5. **Chat mediado** para combinar a devolução com privacidade

Quanto mais detalhada a descrição, melhor o matching! 🎯

Quer cadastrar um objeto agora?`;
  }

  // Perguntas sobre QR Code
  if (/qr|qrcode|etiqueta|codigo|tag/.test(lastMsg)) {
    return `O **QR Code do Backfindr** é permanente e funciona assim:

• Cada objeto cadastrado recebe um **QR Code único e vitalício**
• Você pode imprimir e colar no objeto físico
• Quem encontrar o objeto **escaneia o QR Code** com o celular
• Vê as informações públicas e pode **entrar em contato** com você
• Sua identidade fica protegida — o contato é mediado pelo sistema

É como uma "placa de identificação digital" para seus objetos! 🏷️

Quer cadastrar um objeto e gerar seu QR Code?`;
  }

  // Perguntas sobre pets
  if (/pet|animal|cachorro|gato|cão|cao|dog|cat|bicho/.test(lastMsg)) {
    return `O Backfindr tem suporte especial para **pets perdidos** 🐾

• Cadastre seu pet com foto, raça, cor e características
• QR Code para coleira — quem encontrar escaneia e entra em contato
• Matching automático com registros de pets achados na região
• Alertas para outros usuários próximos

**Seu pet está perdido agora?** Vamos cadastrar imediatamente para aumentar as chances de encontrá-lo!

Qual é o nome e tipo do seu pet?`;
  }

  // Resposta padrão
  return `Entendi! Posso te ajudar com isso.

Para resolver melhor, você pode:
• Acessar o **[Dashboard](https://backfindr.app/dashboard)** para gerenciar seus objetos
• Ver o **[Mapa](https://backfindr.app/map)** de objetos na sua região
• Consultar os **[Planos](https://backfindr.app/pricing)** disponíveis

Ou me diga com mais detalhes o que você precisa e faço o possível para ajudar! 😊`;
}

// ─── OpenAI Integration (ativada quando OPENAI_API_KEY estiver configurada) ───

async function getOpenAIResponse(messages: Message[], context?: ChatRequest['context']): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 500,
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { messages, context } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Mensagens inválidas' }, { status: 400 });
    }

    let reply: string;

    // Usa OpenAI se a chave estiver configurada, senão usa fluxo guiado
    if (process.env.OPENAI_API_KEY) {
      try {
        reply = await getOpenAIResponse(messages, context);
      } catch (err) {
        console.error('OpenAI falhou, usando fluxo guiado:', err);
        reply = getGuidedResponse(messages, context);
      }
    } else {
      reply = getGuidedResponse(messages, context);
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Assistant chat error:', err);
    return NextResponse.json(
      { error: 'Erro interno do assistente' },
      { status: 500 }
    );
  }
}
