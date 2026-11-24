// Frases de CHAMADA do cartaz (a caixa do QR Code) por situação. Refinamento da F-23 (DECISOES.md, 24/11/2026): num cartaz de ACHADO («Encontrei»)
// o público é o DONO, não quem viu o objeto; por isso a chamada muda só quando `status = found`. Perdido, roubado e qualquer outro valor ficam
// EXATAMENTE como eram. Nenhuma frase promete resposta, alerta nem chat (F-23 b e d).
export interface ChamadaDoCartaz {
  quadrado: { titulo: string; linha: string };
  vertical: { titulo: string; linha: string };
  a4: { titulo: string; texto: string };
}

const PADRAO: ChamadaDoCartaz = {
  quadrado: { titulo: 'VOCÊ VIU? ESCANEIE', linha: 'Avise o dono — backfindr.com' },
  vertical: { titulo: 'AJUDE A ENCONTRAR', linha: 'Você viu? Escaneie e avise o dono!' },
  a4: { titulo: 'ESCANEIE SE VOCÊ VIU', texto: 'Escaneie o QR Code para abrir a página do objeto e avisar que você o encontrou.' },
};

const ACHADO: ChamadaDoCartaz = {
  quadrado: { titulo: 'É SEU? ESCANEIE', linha: 'Veja a página do objeto — backfindr.com' },
  vertical: { titulo: 'ESTE OBJETO FOI ENCONTRADO', linha: 'É seu? Escaneie e avise.' },
  a4: { titulo: 'É SEU? ESCANEIE', texto: 'Escaneie o QR Code para abrir a página do objeto e avisar que ele é seu.' },
};

export function chamadaDoCartaz(status: string | null | undefined): ChamadaDoCartaz {
  return status === 'found' ? ACHADO : PADRAO;
}
