'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, Bot, ChevronDown } from 'lucide-react';
import Cookies from 'js-cookie';

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowStep =
  | 'initial'
  | 'lost_category'
  | 'found'
  | 'how_it_works'
  | 'pricing'
  | 'navigate'
  | 'done';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  buttons?: { label: string; action: string; icon?: string }[];
}

// ─── Fluxo determinístico ─────────────────────────────────────────────────────

const APP_URL = 'https://backfindr.com';

const FLOWS: Record<string, { text: string; buttons?: { label: string; action: string }[] }> = {
  initial: {
    text: 'Oi 👋\nVocê perdeu ou encontrou algo?',
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🚨 Foi roubado', action: 'stolen' },
      { label: '🙌 Encontrei algo', action: 'found' },
      { label: '🛡️ Quero me prevenir', action: 'prevent' },
      { label: '🗺️ Navegar no site', action: 'navigate' },
      { label: '❓ Como funciona?', action: 'how' },
    ],
  },

  // ── Perdeu algo ──
  lost: {
    text: 'Sinto muito 😔\n\nJá estamos ajudando casos assim. O que você perdeu?',
    buttons: [
      { label: '🐾 Pet', action: 'lost_pet' },
      { label: '📱 Celular', action: 'lost_phone' },
      { label: '🚗 Carro / Moto', action: 'lost_car' },
      { label: '📄 Documentos', action: 'lost_docs' },
      { label: '📦 Outro objeto', action: 'lost_other' },
    ],
  },
  lost_pet: {
    text: 'Sinto muito 😔\nJá estamos ajudando casos assim. Registra agora — é gratuito 👇\n\n' + APP_URL + '/pet\n\nQuanto antes publicar, maiores as chances 🙏',
  },
  lost_phone: {
    text: 'Sinto muito 😔\nJá estamos conectando casos assim. Registra gratuitamente aqui 👇\n\n' + APP_URL + '/perdi\n\nLeva 30s e aumenta as chances.',
  },
  lost_car: {
    text: 'Sinto muito 😔\nRegistra agora — é gratuito e a rede já começa a ajudar 👇\n\n' + APP_URL + '/perdi\n\nQuanto antes, mais rápido.',
  },
  lost_docs: {
    text: 'Sinto muito 😔\nDocumentos encontrados aparecem aqui com frequência. Registra gratuitamente 👇\n\n' + APP_URL + '/perdi\n\nLeva menos de 1 minuto.',
  },
  lost_other: {
    text: 'Sinto muito 😔\nJá estamos ajudando casos assim. Registra agora — é gratuito 👇\n\n' + APP_URL + '/perdi\n\nLeva menos de 1 minuto.',
  },

  // ── Roubado ──
  stolen: {
    text: 'Complicado 😔\n\nRegistra o quanto antes — já estamos gerando alertas na rede.\nÉ gratuito 👇\n\n' + APP_URL + '/roubado',
  },

  // ── Encontrou algo ──
  found: {
    text: 'Boa atitude 🙏\n\nVocê pode tentar devolver com segurança — é gratuito e seu contato fica protegido 👇\n\n' + APP_URL + '/encontrei',
  },

  // ── Prevenir / QR Code ──
  prevent: {
    text: 'Dá pra se proteger antes 👍\n\nCrie um QR Code em menos de 1 min — é gratuito 👇\n\n' + APP_URL + '/proteger\n\nSe o objeto for encontrado, o achador te contacta direto.',
  },

  // ── Como funciona ──
  how: {
    text: 'É uma plataforma que conecta quem perdeu com quem encontrou, em tempo real.\n\nJá está funcionando e é gratuita 👇\n\n' + APP_URL,
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🙌 Encontrei algo', action: 'found' },
    ],
  },

  // ── Desconfiança ──
  trust: {
    text: 'Já estamos conectando casos reais.\n\nVocê pode testar agora — é gratuito 👇\n\n' + APP_URL,
  },

  // ── Gratuito / Preço ──
  pricing: {
    text: 'Pode usar sem custo pra começar 🙏\n\nRegistra aqui 👇\n\n' + APP_URL,
  },

  // ── Navegação ──
  navigate: {
    text: 'Para onde você quer ir? 👇',
    buttons: [
      { label: '🏠 Início', action: 'nav_home' },
      { label: '🗺️ Mapa ao vivo', action: 'nav_map' },
      { label: '📦 Meus objetos', action: 'nav_dashboard' },
      { label: '➕ Registrar objeto', action: 'nav_new' },
      { label: '🐾 Pets', action: 'nav_pets' },
      { label: '🔔 Notificações', action: 'nav_notifications' },
    ],
  },
  nav_home: { text: 'Indo para o início 👇\n\n' + APP_URL },
  nav_map: { text: 'Mapa ao vivo 👇\n\n' + APP_URL + '/map' },
  nav_dashboard: { text: 'Seus objetos 👇\n\n' + APP_URL + '/dashboard' },
  nav_new: { text: 'Registrar objeto 👇\n\n' + APP_URL + '/dashboard/objects/new' },
  nav_pets: { text: 'Área de pets 👇\n\n' + APP_URL + '/pet' },
  nav_notifications: { text: 'Suas notificações 👇\n\n' + APP_URL + '/dashboard/notifications' },

  // ── Buscar achados ──
  browse_found: {
    text: 'Para ver itens encontrados por outras pessoas, acesse o **Mapa ao vivo** 👇\n\n' + APP_URL + '/map\n\nVocê pode filtrar por categoria, data e localização. Se algum item combinar com o que você perdeu, o sistema notifica automaticamente.',
    buttons: [
      { label: '🗺️ Abrir mapa', action: 'nav_map' },
      { label: '😔 Registrar item perdido', action: 'lost' },
    ],
  },

  // ── Não sabe usar ──
  help_use: {
    text: 'É bem rápido 👍\n\nAbre aqui e segue os passos — leva ~30s 👇\n\n' + APP_URL + '/perdi',
  },

  // ── Já registrou ──
  already_registered: {
    text: 'Perfeito 👍\n\nSe puder, compartilha também — aumenta muito as chances 🙏\n\n' + APP_URL,
  },

  // ── Agradecimento ──
  thanks: {
    text: 'Que bom ajudar 🙏\n\nSe puder, compartilha — isso aumenta as chances de outros casos também.',
  },

  // ── Emocional ──
  emotional: {
    text: 'Entendo, é desesperador mesmo 😔\n\nVamos tentar ajudar — registra aqui (é gratuito) 👇\n\n' + APP_URL + '/perdi\n\nEstou torcendo pra dar certo 🙏',
  },

  // ── Fallback ──
  confused: {
    text: 'Me diz uma coisa 👇\n\nVocê perdeu ou encontrou algo?',
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🙌 Encontrei algo', action: 'found' },
    ],
  },

  // ── Tips de cadastro ──
  tips_description: {
    text: 'Para aumentar muito a chance de match, inclua:\n\n• Cor exata (ex: "azul marinho", não só "azul")\n• Marca e modelo se souber\n• Características únicas (arranhado, adesivo, gravação)\n• Quando e onde perdeu\n• Foto, se tiver\n\nItems com boa descrição têm **3x mais matches** 📈',
  },
  tips_location: {
    text: 'Se não souber o local exato, use o ponto mais próximo que você passou — bairro, rua principal ou estação de metrô.\n\nO sistema usa um raio de busca, então um local aproximado já ajuda bastante 📍',
  },
  tips_photo: {
    text: 'Foto não é obrigatória, mas ajuda muito 📸\n\nSe tiver uma foto do item (mesmo que antiga), vale incluir. O sistema usa a imagem como referência adicional no matching.',
  },
  tips_pet: {
    text: 'Para pets, quanto mais detalhes melhor 🐾\n\nInclua:\n• Espécie e raça\n• Cor e marcações específicas (mancha, orelha diferente)\n• Nome que responde\n• Coleira ou microchip\n• Foto mais recente\n• Bairro onde sumiu',
  },

  // ── Help de funcionalidades ──
  qr_help: {
    text: 'O QR Code funciona assim:\n\n1. Você cadastra o objeto\n2. O sistema gera um QR único e permanente\n3. Você imprime ou usa um adesivo e cola no item\n4. Se alguém encontrar e escanear com qualquer câmera, **você recebe notificação imediata**\n\nSeu número nunca é exposto — contato via chat protegido 🔒\n\nPara gerar o seu: Dashboard → objeto → "Imprimir QR"',
  },
  match_help: {
    text: 'Para confirmar um match:\n\n1. Clique no match pendente\n2. Veja as informações do objeto do outro lado\n3. Se parecer o seu, clique em "Confirmar"\n4. O outro usuário também precisa confirmar\n5. Depois da confirmação dos dois lados, o contato direto é liberado 🤝\n\nDúvida? 👇',
    buttons: [
      { label: '🔍 Ver meus matches', action: 'nav_matches' },
    ],
  },
  match_why: {
    text: 'O sistema compara automaticamente:\n\n• Categoria do objeto\n• Palavras-chave na descrição (com sinônimos em PT-BR)\n• Cor e marca\n• Distância geográfica\n• Data aproximada\n\nQuando a compatibilidade é alta, os dois lados são notificados. Você confirma se faz sentido antes de qualquer contato ser liberado.',
  },
  notif_help: {
    text: 'Tipos de notificação:\n\n🔴 **QR escaneado** — alguém escaneou o QR do seu objeto\n🟡 **Novo match** — IA encontrou um possível par\n🟢 **Match confirmado** — os dois lados confirmaram\n📧 **Reativação** — objeto sem match por 24h, com dicas\n\nTodas ficam em: Dashboard → Notificações',
  },
  privacy_help: {
    text: 'Seu contato fica 100% protegido 🔒\n\nO número de telefone nunca é exibido publicamente. A página pública do objeto mostra apenas informações básicas do item.\n\nContato só acontece via chat interno após confirmação dos dois lados — ou via WhatsApp com número protegido.',
  },
  map_help: {
    text: 'No mapa ao vivo você vê:\n\n🔴 Pin vermelho = objeto perdido\n🟢 Pin verde = objeto achado\n🟡 Pin amarelo = objeto roubado\n\nClique em qualquer pin para ver os detalhes. Ative sua localização para ver ocorrências próximas de você.\n\nFunciona sem login 👍',
  },
  cancel_help: {
    text: 'Sim, pode cancelar a qualquer momento pelo painel em:\n\nhttps://backfindr.com/dashboard/billing\n\nSem fidelidade, sem multa. O plano continua ativo até o fim do período pago.',
  },
  contact_help: {
    text: 'Para contatar o dono:\n\n1. Clique em "Avisar dono" na página do objeto\n2. Deixe uma mensagem — o dono recebe uma notificação imediata\n3. Ele pode responder via chat interno\n\nSeu número não é exposto em nenhum momento 🔒',
  },

  // ── Planos ──
  plan_free: {
    text: 'O plano Grátis resolve pra maioria das pessoas:\n\n✅ Até 3 objetos cadastrados\n✅ QR Code permanente para cada objeto\n✅ Busca na rede\n✅ Notificações de match\n\nSe precisar de mais de 3 objetos ou quiser matching automático com IA rodando 24h, aí vale ver o Pro.\n\nVer planos 👇\n\nhttps://backfindr.com/pricing',
  },
  plan_pro: {
    text: 'O Pro adiciona:\n\n🚀 Até 50 objetos cadastrados\n🤖 Matching automático com IA (24h por dia)\n🔔 Notificações push + e-mail em tempo real\n🎨 QR Code personalizado\n📧 Suporte por e-mail\n\nR$ 29/mês — sem fidelidade.\n\nhttps://backfindr.com/pricing',
  },
  plan_business: {
    text: 'Para empresas (hotéis, escolas, condomínios):\n\n🏢 Até 500 objetos\n⚡ Matching prioritário\n📲 Push + e-mail + SMS\n👥 Até 5 usuários\n🔗 API de integração\n\nR$ 149/mês. Para falar com a equipe:\nbusiness@backfindr.com',
  },

  // ── Roubado ──
  stolen_bo: {
    text: 'Além de registrar no Backfindr, recomendo:\n\n1. **B.O. eletrônico** — delegacia.sp.gov.br (gratuito e rápido)\n2. Se for celular: bloqueie pelo operadora e registre o IMEI no B.O.\n3. Avise amigos e grupos do bairro com foto e descrição\n4. Monitore marketplaces (OLX, Facebook Marketplace) — itens roubados aparecem\n\nRegistra no Backfindr também — a rede pode identificar o item 👇\n\nhttps://backfindr.com/roubado',
  },

  // ── Matches ──
  nav_matches: {
    text: 'Seus matches 👇\n\nhttps://backfindr.com/dashboard/matches',
  },
  improve_listing: {
    text: 'Para melhorar um cadastro já existente:\n\n1. Acesse o objeto no Dashboard\n2. Clique em "Editar"\n3. Adicione: cor exata, marca, características únicas, foto e localização precisa\n\nCada detalhe extra aumenta a chance de match. Itens com foto têm **3x mais** resultado 📈',
  },

  followup: {
    text: 'Posso te ajudar com mais alguma coisa? 😊',
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🙌 Encontrei algo', action: 'found' },
    ],
  },
};

// ─── Saudação por horário ─────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia! 🌅';
  if (hour >= 12 && hour < 18) return 'Boa tarde! ☀️';
  return 'Boa noite! 🌙';
}

// ─── Abertura contextual por página ──────────────────────────────────────────
// Em vez de sempre abrir com "Você perdeu ou encontrou algo?",
// o bot abre com mensagem relevante para o que o usuário está fazendo.

interface ContextualOpening {
  text: string;
  buttons?: { label: string; action: string }[];
}

function getContextualOpening(pathname: string): ContextualOpening {
  if (pathname === '/dashboard') {
    return {
      text: 'Oi 👋 Posso te ajudar com alguma coisa no dashboard?',
      buttons: [
        { label: '➕ Registrar objeto', action: 'nav_new' },
        { label: '🔍 Ver matches', action: 'nav_matches' },
        { label: '🔔 Notificações', action: 'nav_notifications' },
        { label: '❓ Como funciona?', action: 'how' },
      ],
    };
  }
  if (pathname === '/dashboard/objects') {
    return {
      text: 'Quer registrar um novo objeto ou tem dúvida sobre algum cadastrado?',
      buttons: [
        { label: '➕ Registrar novo', action: 'nav_new' },
        { label: '❓ Como funciona o QR?', action: 'qr_help' },
        { label: '💡 Como melhorar meu cadastro?', action: 'improve_listing' },
      ],
    };
  }
  if (pathname === '/dashboard/objects/new' || (pathname.startsWith('/dashboard/objects/') && pathname.endsWith('/edit'))) {
    return {
      text: 'Quer ajuda para preencher o cadastro? Quanto mais detalhes, maior a chance de match 💡',
      buttons: [
        { label: '📝 Dicas de descrição', action: 'tips_description' },
        { label: '📍 Não sei a localização exata', action: 'tips_location' },
        { label: '📸 Precisa de foto?', action: 'tips_photo' },
      ],
    };
  }
  if (pathname === '/dashboard/matches') {
    return {
      text: 'Aqui ficam os objetos que o sistema identificou como possível match com o seu 🎯\n\nTem dúvida sobre como confirmar?',
      buttons: [
        { label: '❓ Como confirmar um match?', action: 'match_help' },
        { label: '🤔 Por que esse objeto apareceu?', action: 'match_why' },
      ],
    };
  }
  if (pathname === '/dashboard/notifications') {
    return {
      text: 'Aqui aparecem todos os alertas — QR escaneado, novos matches e atualizações 🔔\n\nPosso te ajudar com alguma notificação?',
      buttons: [
        { label: '❓ O que significa cada tipo?', action: 'notif_help' },
        { label: '😔 Quero registrar algo perdido', action: 'lost' },
      ],
    };
  }
  if (pathname === '/dashboard/settings' || pathname === '/dashboard/billing') {
    return {
      text: 'Posso te ajudar com configurações ou dúvidas sobre planos 👇',
      buttons: [
        { label: '💳 Quais são os planos?', action: 'pricing' },
        { label: '❓ Posso cancelar a qualquer hora?', action: 'cancel_help' },
      ],
    };
  }
  if (pathname === '/pricing') {
    return {
      text: 'Comparando os planos? Me conta o que você precisa que te ajudo a escolher 👇',
      buttons: [
        { label: '🆓 O grátis resolve pra mim?', action: 'plan_free' },
        { label: '🚀 Qual a diferença do Pro?', action: 'plan_pro' },
        { label: '🏢 Tenho uma empresa', action: 'plan_business' },
      ],
    };
  }
  if (pathname === '/map') {
    return {
      text: 'Vendo o mapa ao vivo 🗺️\n\nViu algum objeto que pode ser o seu ou que você encontrou?',
      buttons: [
        { label: '😔 Pode ser o meu', action: 'lost' },
        { label: '🙌 Encontrei algo aqui', action: 'found' },
        { label: '❓ Como usar o mapa?', action: 'map_help' },
      ],
    };
  }
  if (pathname === '/perdi' || pathname === '/flow/lost') {
    return {
      text: 'Sinto muito 😔 Estou aqui pra te ajudar no cadastro.\n\nSe travar em alguma etapa, é só me chamar.',
      buttons: [
        { label: '📝 Dicas de descrição', action: 'tips_description' },
        { label: '📍 Não sei o local exato', action: 'tips_location' },
      ],
    };
  }
  if (pathname === '/encontrei' || pathname === '/flow/found') {
    return {
      text: 'Que atitude incrível tentar devolver 🙏\n\nPosso ajudar com alguma dúvida no cadastro?',
      buttons: [
        { label: '🔒 Meu contato fica exposto?', action: 'privacy_help' },
        { label: '📝 O que devo preencher?', action: 'tips_description' },
      ],
    };
  }
  if (pathname === '/pet' || pathname === '/flow/pet') {
    return {
      text: 'Cada minuto conta quando um pet some 🐾\n\nEstou aqui — precisando de ajuda no cadastro?',
      buttons: [
        { label: '📝 O que descrever de um pet?', action: 'tips_pet' },
        { label: '📍 Não sei o local exato', action: 'tips_location' },
      ],
    };
  }
  if (pathname === '/roubado' || pathname === '/flow/stolen') {
    return {
      text: 'Situação difícil 😔 Além do Backfindr, tem algumas medidas que ajudam bastante.\n\nQuer que eu explique o que fazer primeiro?',
      buttons: [
        { label: '🚔 Orientações sobre B.O.', action: 'stolen_bo' },
        { label: '📱 Roubaram meu celular', action: 'lost_phone' },
      ],
    };
  }
  if (pathname.startsWith('/objeto/') || pathname.startsWith('/scan/')) {
    return {
      text: 'Você escaneou um QR Code do Backfindr 👋\n\nPosso te ajudar a contatar o dono com segurança.',
      buttons: [
        { label: '📞 Como contato o dono?', action: 'contact_help' },
        { label: '🔒 Meu número fica protegido?', action: 'privacy_help' },
      ],
    };
  }
  if (pathname === '/faq') {
    return {
      text: 'Tem alguma dúvida específica? Me pergunta que respondo na hora 👇',
      buttons: [
        { label: '❓ Como funciona o QR?', action: 'qr_help' },
        { label: '🤖 Como funciona o matching?', action: 'match_why' },
        { label: '🆓 É mesmo gratuito?', action: 'pricing' },
      ],
    };
  }
  // Fallback — home e demais páginas
  return {
    text: 'Oi 👋\nVocê perdeu ou encontrou algo?',
    buttons: [
      { label: '😔 Perdi algo', action: 'lost' },
      { label: '🚨 Foi roubado', action: 'stolen' },
      { label: '🙌 Encontrei algo', action: 'found' },
      { label: '🛡️ Quero me prevenir', action: 'prevent' },
      { label: '🗺️ Navegar no site', action: 'navigate' },
      { label: '❓ Como funciona?', action: 'how' },
    ],
  };
}

// ─── Detectar intenção por texto livre ───────────────────────────────────────

function detectIntent(text: string): string | null {
  const t = text.toLowerCase();

  // Saudação
  if (/^(oi|olá|ola|hey|ei|hello|bom dia|boa tarde|boa noite|boas|salve|e aí|e ai|tudo bem|tudo bom)/.test(t)
    || /^(oi |olá |ola |hey |ei )/.test(t)) return 'greeting';

  // Navegação — só captura quando há intenção EXPLÍCITA de ir para algum lugar
  const isQuestion = /\b(como|o que|por que|quando|onde|qual|quem|quanto)\b/.test(t);
  const isNavigationIntent = /\b(ir para|abrir|acessar|navegar|quero ver|me leva|me mostra|vai para|leva para)\b/.test(t)
    || (!isQuestion && /\b(ver|mostrar)\b/.test(t));

  if (isNavigationIntent) {
    if (/mapa/.test(t)) return 'nav_map';
    if (/dashboard|painel|meus objetos/.test(t)) return 'nav_dashboard';
    if (/registrar|novo objeto|cadastrar/.test(t)) return 'nav_new';
    if (/pet|animal|cachorro|gato/.test(t) && !/perdi|achei/.test(t)) return 'nav_pets';
    if (/notifica/.test(t)) return 'nav_notifications';
    if (/início|home|começo/.test(t)) return 'nav_home';
    if (!isQuestion) return 'navigate';
  }

  // Roubado — antes de "perdeu" para não confundir
  if (/\b(roubaram|furtaram|roubado|furtado|assaltaram|assalto|furto|roubo)\b/.test(t)) return 'stolen';

  // Perdeu algo — categorias específicas
  const isLostReport = /\b(perdi|perdeu|desapareceu|sumiu)\b/.test(t)
    || (/\b(perder)\b/.test(t) && !isQuestion);
  if (isLostReport) {
    if (/pet|cachorro|gato|animal|cão/.test(t)) return 'lost_pet';
    if (/celular|telefone|iphone|android|smartphone/.test(t)) return 'lost_phone';
    if (/carro|veículo|moto|bicicleta/.test(t)) return 'lost_car';
    if (/document|rg|cpf|passaporte|carteira|cartão/.test(t)) return 'lost_docs';
    return 'lost_other';
  }

  // Encontrou algo
  if (/\b(achei|encontrei|achar|encontrar)\b/.test(t)) return 'found';

  // Prevenir / QR Code
  if (/\b(prevenir|prevenção|proteger|proteção|qr|qr code|evitar perder|antes de perder)\b/.test(t)) return 'prevent';

  // Perguntas sobre como ver/buscar itens no sistema
  if (/como.*(ver|buscar|encontrar|achar|procurar).*(perdid|achad|objeto|item|coisa|pet|celular|carro)/.test(t)
    || /(perdid|achad|objeto|item).*(onde|como).*(ver|buscar|achar|encontrar)/.test(t)
    || /onde.*(ver|achar|encontrar|buscar).*(perdid|achad|objeto|item|coisa)/.test(t)) return 'browse_found';

  // Desconfiança
  if (/\b(funciona mesmo|é confiável|é seguro|é verdade|é real|tem resultado|resolve mesmo|acreditar)\b/.test(t)) return 'trust';

  // Não sabe usar
  if (/\b(não sei usar|como usar|não sei como|não consigo|não entendo|me ajuda a usar)\b/.test(t)) return 'help_use';

  // Já registrou
  if (/\b(já registrei|já cadastrei|já publiquei|já coloquei)\b/.test(t)) return 'already_registered';

  // Agradecimento
  if (/\b(obrigad|valeu|muito obrigad|agradeço|obg|vlw|thanks)\b/.test(t)) return 'thanks';

  // Como funciona
  if (/como funciona|o que é|como usar|como cadastr/.test(t)) return 'how';

  // Gratuito
  if (/gratu|grátis|gratuito|pago|custo|preço|plano/.test(t)) return 'pricing';

  // Emocional
  if (/desespera|angustia|triste|chorando|preciso muito|importante demais/.test(t)) return 'emotional';

  return null;
}

// ─── Gatilhos de transferência para GPT-mini ────────────────────────────────────
// Retorna true quando a mensagem deve ir direto para a Camada 2 (GPT-mini),
// sem passar pela detecção determinística local.

function shouldEscalateToGPT(text: string, history: Message[]): boolean {
  const t = text.toLowerCase();

  // 1. Múltiplas intenções na mesma mensagem
  const intentKeywords = [
    /\b(perdi|perdeu|sumiu|desapareceu)\b/,
    /\b(achei|encontrei)\b/,
    /\b(roubado|roubaram|furtado|furtaram|assalt)\b/,
    /\b(prevenir|proteger|qr|qr code)\b/,
    /\b(como funciona|o que é|me explica)\b/,
  ];
  const matchedIntents = intentKeywords.filter(re => re.test(t)).length;
  if (matchedIntents >= 2) return true;

  // 2. Mensagem muito longa (mais de 140 caracteres sem intenção clara)
  if (text.length > 140) return true;

  // 3. Linguagem emocional intensa (desespero, urgência extrema)
  if (/\b(desesperado|desesperada|chorando|imploro|por favor me ajuda|urgente|preciso urgente|tô desesperado|to desesperado|não sei o que fazer|nao sei o que fazer)\b/.test(t)) return true;

  // 4. Pergunta aberta sem intenção clara
  if (/^(como|por que|por quê|quando|o que acontece|o que devo|me explica|me conta|pode me dizer)/.test(t) && text.length > 30) return true;

  // 5. Repetição de dúvida (usuário já fez pergunta parecida antes)
  if (history.length >= 4) {
    const userMsgs = history.filter(m => m.role === 'user').slice(-3).map(m => m.content.toLowerCase());
    const hasSimilar = userMsgs.some(prev => {
      const words = t.split(/\s+/).filter(w => w.length > 4);
      return words.some(w => prev.includes(w)) && prev !== t;
    });
    if (hasSimilar) return true;
  }

  // 6. Mensagem ambígua com condições compostas ("mas", "e também", "além disso")
  if (/\b(mas também|e também|além disso|ao mesmo tempo|não sei se|acho que pode ser|não tenho certeza|pode ser que)\b/.test(t)) return true;

  return false;
}

// ─── Markdown simples ─────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-400 underline" target="_blank">$1</a>');
  // URLs isoladas viram links clicáveis
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" class="text-brand-400 underline font-medium" target="_blank">$1</a>');
  html = html.replace(/\n/g, '<br />');
  return html;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssistantWidget() {
  const pathname = usePathname();
  const isMap = pathname === '/map';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [followupSent, setFollowupSent] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const followupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages, scrollToBottom]);

  // Mensagem inicial ao abrir pela primeira vez — contextual por página
  useEffect(() => {
    if (open && messages.length === 0) {
      const contextual = getContextualOpening(pathname);
      addBotMessage(contextual);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Follow-up desativado — o bot responde apenas quando o usuário interage

  const addBotMessage = useCallback((flow: typeof FLOWS[string]) => {
    const msg: Message = {
      id: Date.now().toString() + Math.random(),
      role: 'assistant',
      content: flow.text,
      timestamp: new Date(),
      buttons: flow.buttons,
    };
    setMessages(prev => [...prev, msg]);
    if (!open) setUnread(prev => prev + 1);
  }, [open]);

  const handleAction = useCallback((action: string) => {
    // Marcar que o usuário interagiu e cancelar follow-up pendente
    setUserHasInteracted(true);
    if (followupTimerRef.current) clearTimeout(followupTimerRef.current);
    setFollowupSent(false);

    // Adicionar mensagem do usuário visível
    const labelMap: Record<string, string> = {
      lost: '😔 Perdi algo',
      stolen: '🚨 Foi roubado',
      found: '🙌 Encontrei algo',
      prevent: '🛡️ Quero me prevenir',
      navigate: '🗺️ Navegar no site',
      how: '❓ Como funciona?',
      lost_pet: '🐾 Pet',
      lost_phone: '📱 Celular',
      lost_car: '🚗 Carro / Moto',
      lost_docs: '📄 Documentos',
      lost_other: '📦 Outro objeto',
      nav_home: '🏠 Início',
      nav_map: '🗺️ Mapa ao vivo',
      nav_dashboard: '📦 Meus objetos',
      nav_new: '➕ Registrar objeto',
      nav_pets: '🐾 Pets',
      nav_notifications: '🔔 Notificações',
      nav_matches: '🔍 Ver matches',
      tips_description: '📝 Dicas de descrição',
      tips_location: '📍 Não sei a localização',
      tips_photo: '📸 Precisa de foto?',
      tips_pet: '📝 O que descrever de um pet?',
      qr_help: '❓ Como funciona o QR?',
      match_help: '❓ Como confirmar um match?',
      match_why: '🤔 Por que esse objeto apareceu?',
      notif_help: '❓ O que significa cada tipo?',
      privacy_help: '🔒 Meu contato fica exposto?',
      map_help: '❓ Como usar o mapa?',
      cancel_help: '❓ Posso cancelar a qualquer hora?',
      contact_help: '📞 Como contato o dono?',
      plan_free: '🆓 O grátis resolve pra mim?',
      plan_pro: '🚀 Diferença do Pro?',
      plan_business: '🏢 Tenho uma empresa',
      stolen_bo: '🚔 Orientações sobre B.O.',
      improve_listing: '💡 Como melhorar meu cadastro?',
      pricing: '💳 Quais são os planos?',
    };

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: labelMap[action] ?? action,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Responder com o fluxo correspondente
    setTimeout(() => {
      const flow = FLOWS[action];
      if (flow) {
        addBotMessage(flow);
      } else {
        addBotMessage(FLOWS.confused);
      }
    }, 400);
  }, [addBotMessage, followupSent]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');

    // Marcar que o usuário interagiu e resetar follow-up
    setUserHasInteracted(true);
    if (followupTimerRef.current) clearTimeout(followupTimerRef.current);
    setFollowupSent(false);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Verificar se deve escalar para GPT-mini antes da detecção local
    const escalate = shouldEscalateToGPT(msg, messages);

    // Tentar detectar intenção localmente primeiro (apenas se não escalou)
    const intent = !escalate ? detectIntent(msg) : null;
    if (intent) {
      if (intent === 'greeting') {
        const greetingFlow = {
          text: `${getGreeting()}\n\nSou o **Findr**, assistente do Backfindr 🐾\n\nComo posso te ajudar?`,
          buttons: [
            { label: '😔 Perdi algo', action: 'lost' },
            { label: '🚨 Foi roubado', action: 'stolen' },
            { label: '🙌 Encontrei algo', action: 'found' },
            { label: '🛡️ Quero me prevenir', action: 'prevent' },
          ],
        };
        setTimeout(() => addBotMessage(greetingFlow), 400);
        return;
      }
      if (FLOWS[intent]) {
        setTimeout(() => addBotMessage(FLOWS[intent]), 400);
        return;
      }
    }

    // Fallback para API (OpenAI quando disponível, guided flow caso contrário)
    setLoading(true);
    try {
      const token = Cookies.get('access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const allMessages = [...messages, userMsg];
      const res = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          context: { page: typeof window !== 'undefined' ? window.location.pathname : '/' },
        }),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply ?? 'Desculpe, não consegui processar sua mensagem.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (!open) setUnread(prev => prev + 1);
    } catch {
      addBotMessage(FLOWS.confused);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, open, addBotMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Posicionamento: esquerda no mapa, direita nas demais páginas
  const positionClass = isMap
    ? 'fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3'
    : 'fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3';

  const windowAlignClass = isMap ? 'origin-bottom-left' : 'origin-bottom-right';

  return (
    <>
      <div className={positionClass}>
        {/* Chat window */}
        {open && (
          <div
            className={`w-[340px] max-w-[calc(100vw-3rem)] bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${windowAlignClass}`}
            style={{ height: 'min(500px, calc(100vh - 120px))' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-brand-600/20 to-transparent flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-none">Findr</p>
                  <p className="text-brand-400 text-xs mt-0.5">Assistente Backfindr</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-brand-500 text-white rounded-tr-sm'
                          : 'bg-white/[0.06] text-slate-200 rounded-tl-sm'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content,
                      }}
                    />
                  </div>

                  {/* Botões de ação */}
                  {msg.role === 'assistant' && msg.buttons && msg.buttons.length > 0 && (
                    <div className="ml-8 flex flex-wrap gap-1.5">
                      {msg.buttons.map((btn) => (
                        <button
                          key={btn.action}
                          onClick={() => handleAction(btn.action)}
                          className="text-xs px-3 py-1.5 rounded-full border border-brand-500/40 text-brand-300 hover:bg-brand-500/15 hover:border-brand-400 transition-all active:scale-95"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-3 py-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-sm outline-none"
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="p-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setOpen(prev => !prev)}
          className="relative w-14 h-14 rounded-2xl gradient-brand shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center glow-teal"
          aria-label="Abrir assistente"
        >
          {open ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <MessageCircle className="w-6 h-6 text-white" />
          )}
          {!open && unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
