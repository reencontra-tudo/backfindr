// INTERRUPTOR ÚNICO do «MODO CRESCIMENTO» (PL-01, decisão do fundador, 24/11/2026): PAUSAR, NÃO APAGAR.
//
// Variável de ambiente: NEXT_PUBLIC_MODO_CRESCIMENTO (Vercel → Settings → Environment Variables; vale no servidor e no navegador, exige redeploy).
//   • ausente ou qualquer valor diferente de «0»  → LIGADO (estado atual): free com teto anti-abuso (100 objetos ativos, 10 por 24 h); Pro e Business
//     ESCONDIDOS (preços, painel de planos, avisos de upgrade, assistente, chat de IA e FAQ); nenhuma nova assinatura de plano; textos de crescimento.
//   • «0»                                           → DESLIGADO: tudo volta EXATAMENTE como antes do PL-01 (free 3, Pro 50, Business 500, preços, páginas
//     e textos originais). Nada foi apagado: os textos originais continuam no código, só inativos.
// Para voltar: definir NEXT_PUBLIC_MODO_CRESCIMENTO=0 em Production e fazer um redeploy. Nenhuma linha de código precisa mudar.
// A nova CONTAGEM de objetos (sem arquivados, devolvidos, apagados e legados) vale nos dois estados (decisão do fundador).
// Contas que JÁ têm plano pago continuam com o plano e os benefícios até o fim do período, nos dois estados.
export const modoCrescimento = (): boolean => process.env.NEXT_PUBLIC_MODO_CRESCIMENTO !== '0';

/** Novas assinaturas de plano ficam bloqueadas no modo crescimento (cancelar e usar o plano atual continuam funcionando). */
export const assinaturasPausadas = (): boolean => modoCrescimento();

export const MSG_ASSINATURAS_PAUSADAS =
  'As assinaturas de plano estão pausadas por enquanto. O plano gratuito já permite cadastrar quantos objetos você precisar.';

/** Textos do modo crescimento (os originais ficam nos próprios componentes, só inativos). */
export const TEXTOS_CRESCIMENTO = {
  free: {
    features: ['Cadastre quantos precisar', 'QR Code permanente', 'Busca manual na rede', 'Suporte da comunidade'],
    linhaDoCartao: 'Cadastre quantos precisar',
  },
  precosTitulo: 'Comece grátis',
  precosSubtitulo: 'Cadastre quantos objetos precisar, sem custo. Para ampliar o alcance de uma ocorrência, existe o Boost.',
  precosFaqLimite: {
    q: 'Existe limite de objetos?',
    a: 'Não há limite prático: cadastre quantos objetos precisar. Existe apenas um teto contra abuso (100 objetos ativos e 10 cadastros por dia); objetos já resolvidos, arquivados ou devolvidos não contam.',
  },
  precosFaqQr: { q: 'O QR Code expira?', a: 'Não. O QR Code é permanente. Se alguém encontrar seu item e escanear, você recebe o aviso.' },
  faqPets: 'Sim. Você pode cadastrar quantos pets precisar (há apenas um teto contra abuso: 100 objetos ativos e 10 cadastros por dia).',
  faqLimite: 'Não há limite prático: cadastre quantos objetos precisar. Existe apenas um teto contra abuso (100 objetos ativos e 10 cadastros por dia); objetos já resolvidos, arquivados ou devolvidos não contam. O QR Code é permanente e o matching por IA está incluído.',
  assistenteFree: 'O Backfindr é gratuito para você começar:\n\n✅ Cadastre quantos objetos precisar\n✅ QR Code permanente para cada objeto\n✅ Busca na rede\n✅ Notificações de match\n\nPara ampliar o alcance de uma ocorrência, existe o Boost (pagamento único).\n\nhttps://backfindr.com/pricing',
  assinaturasPausadasAssistente: 'As assinaturas de plano estão pausadas por enquanto. O plano gratuito já permite cadastrar quantos objetos você precisar.',
  limiteAtingidoCadastro: 'Você atingiu o teto de objetos ativos. Arquive ou marque como devolvidos os que já foram resolvidos para continuar cadastrando.',
} as const;
