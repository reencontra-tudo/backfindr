/**
 * notifyModulos.ts
 * Helpers de notificação (push + DB) para Portaria, Custody e Delivery.
 * Segue o mesmo padrão de pushNotification.ts existente.
 */

import { query } from './db';
import { sendPushToUser } from './pushNotification';

// ─── Salvar notificação no banco + disparar push ──────────────────────────────
async function notificar(
  userId: string,
  titulo: string,
  mensagem: string,
  tipo: string,
  url?: string
) {
  try {
    await query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, titulo, mensagem, tipo]
    );
    await sendPushToUser(userId, {
      title: titulo,
      body: mensagem,
      url: url ?? '/dashboard/notifications',
      tag: tipo,
    });
  } catch (err) {
    console.error('[notifyModulos] erro ao notificar:', err);
  }
}

// ─── PORTARIA ────────────────────────────────────────────────────────────────

export async function notificarEncomendaChegou(
  moradorId: string,
  remetente: string,
  nomeCondominio: string
) {
  await notificar(
    moradorId,
    '📦 Encomenda chegou!',
    `Chegou uma encomenda de ${remetente} na portaria do ${nomeCondominio}.`,
    'encomenda_chegou',
    '/dashboard'
  );
}

export async function notificarEncomendaEntregue(
  moradorId: string,
  remetente: string
) {
  await notificar(
    moradorId,
    '✅ Encomenda retirada',
    `Sua encomenda de ${remetente} foi retirada com sucesso.`,
    'encomenda_entregue',
    '/dashboard'
  );
}

// ─── CUSTODY ────────────────────────────────────────────────────────────────

export async function notificarCustodiaCriada(
  remetenteId: string,
  descricao: string,
  destinatarioNome: string
) {
  await notificar(
    remetenteId,
    '🔒 Custódia registrada',
    `"${descricao}" foi registrado para retirada por ${destinatarioNome}.`,
    'custodia_criada',
    '/dashboard'
  );
}

export async function notificarCustodiaRecebida(
  remetenteId: string,
  descricao: string,
  custodianteNome: string
) {
  await notificar(
    remetenteId,
    '📬 Item sob custódia',
    `"${descricao}" está sob custódia de ${custodianteNome}.`,
    'custodia_recebida',
    '/dashboard'
  );
}

export async function notificarCustodiaEntregue(
  remetenteId: string,
  descricao: string,
  destinatarioNome: string,
  hora: string
) {
  await notificar(
    remetenteId,
    '✅ Item entregue',
    `"${descricao}" foi retirado por ${destinatarioNome} às ${hora}.`,
    'custodia_entregue',
    '/dashboard'
  );
}

// ─── DELIVERY ────────────────────────────────────────────────────────────────

export async function notificarEntregaSaiu(
  clienteId: string,
  descricao: string,
  estabelecimento: string
) {
  await notificar(
    clienteId,
    '🛵 Pedido saiu para entrega',
    `Seu pedido de ${estabelecimento} está a caminho: "${descricao}".`,
    'entrega_saiu',
    '/dashboard'
  );
}

export async function notificarEntregaProximo(
  clienteId: string,
  estabelecimento: string
) {
  await notificar(
    clienteId,
    '📍 Entregador chegando',
    `O entregador de ${estabelecimento} está chegando perto de você.`,
    'entrega_proximo',
    '/dashboard'
  );
}

export async function notificarEntregaNaPortaria(
  clienteId: string,
  estabelecimento: string
) {
  await notificar(
    clienteId,
    '🔔 Entregador na portaria',
    `O pedido de ${estabelecimento} chegou na portaria. Retire quando puder.`,
    'entrega_na_portaria',
    '/dashboard'
  );
}

export async function notificarEntregaConfirmada(
  clienteId: string,
  estabelecimento: string
) {
  await notificar(
    clienteId,
    '✅ Entrega confirmada',
    `Seu pedido de ${estabelecimento} foi entregue com sucesso.`,
    'entrega_confirmada',
    '/dashboard'
  );
}

export async function notificarEntregadorComprovanteGerado(
  entregadorId: string,
  descricao: string,
  clienteNome: string
) {
  await notificar(
    entregadorId,
    '📋 Comprovante gerado',
    `Entrega de "${descricao}" para ${clienteNome} confirmada e registrada.`,
    'entregador_comprovante',
    '/dashboard'
  );
}

// ─── Envio WhatsApp (stub — integrar Z-API ou Meta API) ──────────────────────
export async function enviarWhatsApp(
  telefone: string,
  mensagem: string
): Promise<void> {
  // TODO: integrar Z-API (piloto) ou Meta API (produção)
  // Documentação Z-API: https://developer.z-api.io/
  // Documentação Meta: https://developers.facebook.com/docs/whatsapp/cloud-api
  console.log(`[WhatsApp stub] Para: ${telefone} | Mensagem: ${mensagem}`);

  const zApiUrl = process.env.ZAPI_URL;
  const zApiToken = process.env.ZAPI_TOKEN;
  const zApiClientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!zApiUrl || !zApiToken || !zApiClientToken) {
    console.warn('[WhatsApp] ZAPI não configurado — mensagem não enviada');
    return;
  }

  try {
    await fetch(`${zApiUrl}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zApiClientToken,
      },
      body: JSON.stringify({ phone: telefone, message: mensagem }),
    });
  } catch (err) {
    console.error('[WhatsApp] erro ao enviar:', err);
  }
}

// ─── Gerar token único para links ─────────────────────────────────────────────
export function gerarToken(prefixo: string = ''): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = prefixo;
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export function gerarQrCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ─── Calcular distância entre dois pontos (Haversine) ────────────────────────
export function calcularDistanciaMetros(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
