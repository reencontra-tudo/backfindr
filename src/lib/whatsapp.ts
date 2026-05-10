/**
 * whatsapp.ts
 * Helper central de wa.me para o Backfindr.
 *
 * Todos os templates de mensagem do sistema em um lugar.
 * Nenhuma dependência externa — usa apenas a URL pública do WhatsApp.
 *
 * Dois modos:
 *   abrirWhatsApp(telefone, mensagem)  — abre conversa com número específico
 *   compartilharWhatsApp(mensagem)     — abre WhatsApp para o usuário escolher o contato/grupo
 */

const APP_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

// ─── Base ─────────────────────────────────────────────────────────────────────

/** Abre WhatsApp com número e mensagem pré-preenchida */
export function abrirWhatsApp(telefone: string, mensagem: string) {
  const numero = telefone.replace(/\D/g, '');
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Abre WhatsApp sem número — usuário escolhe o contato ou grupo */
export function compartilharWhatsApp(mensagem: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ─── Templates por módulo ─────────────────────────────────────────────────────

// PORTARIA — Encomenda chegou
export function msgEncomendaChegou(params: {
  moradorNome: string;
  remetente: string;
  unidade: string;
  condominioNome: string;
  hora: string;
}): string {
  return (
    `📦 *Backfindr Portaria — ${params.condominioNome}*\n\n` +
    `Olá${params.moradorNome ? `, ${params.moradorNome.split(' ')[0]}` : ''}! ` +
    `Chegou uma encomenda de *${params.remetente}* para o Apto ${params.unidade}.\n\n` +
    `🕐 Recebida às ${params.hora}\n\n` +
    `Retire na portaria quando puder. ✅`
  );
}

// PORTARIA — Encomenda retirada (confirmação ao morador)
export function msgEncomendaRetirada(params: {
  moradorNome: string;
  remetente: string;
  hora: string;
}): string {
  return (
    `✅ *Backfindr Portaria*\n\n` +
    `Sua encomenda de *${params.remetente}* foi retirada às ${params.hora}.\n\n` +
    `Qualquer dúvida, fale com a portaria.`
  );
}

// PORTARIA — Convidar morador para cadastro (kit de ativação)
export function msgConviteMorador(params: {
  condominioNome: string;
  linkCadastro: string;
}): string {
  return (
    `🏢 *${params.condominioNome}*\n\n` +
    `Caro condômino,\n\n` +
    `Nosso condomínio adotou o *Backfindr* — sistema inteligente de portaria e achados e perdidos.\n\n` +
    `Cadastre-se gratuitamente para:\n` +
    `• Receber alertas quando encomendas chegarem\n` +
    `• Participar da rede de achados e perdidos\n` +
    `• Proteger seus objetos com QR Code\n\n` +
    `👉 ${params.linkCadastro}\n\n` +
    `_Leva menos de 2 minutos. É gratuito._`
  );
}

// PORTARIA — Circular impressa (texto para o síndico copiar)
export function msgCircularPortaria(params: {
  condominioNome: string;
  linkCadastro: string;
}): string {
  return (
    `📋 *AVISO — ${params.condominioNome}*\n\n` +
    `A partir de agora, a portaria utiliza o sistema Backfindr para registro e aviso de encomendas.\n\n` +
    `*Moradores não cadastrados não receberão alertas de encomendas.*\n\n` +
    `Faça seu cadastro gratuito:\n` +
    `${params.linkCadastro}\n\n` +
    `Administração`
  );
}

// CUSTODY — Link de retirada para o destinatário
export function msgCustodiaDestinatario(params: {
  remetenteNome: string;
  descricao: string;
  linkRetirada: string;
  localNome?: string;
}): string {
  return (
    `📦 *Backfindr Custody*\n\n` +
    `*${params.remetenteNome}* deixou um item para você retirar:\n` +
    `"${params.descricao}"\n\n` +
    (params.localNome ? `📍 Local: ${params.localNome}\n\n` : '') +
    `Use este link para confirmar a retirada:\n` +
    `${params.linkRetirada}\n\n` +
    `_O link é pessoal e intransferível._`
  );
}

// CUSTODY — Remetente avisa que item está sob custódia
export function msgCustodiaConfirmada(params: {
  descricao: string;
  custodianteNome: string;
  destinatarioNome: string;
}): string {
  return (
    `🔒 *Backfindr Custody*\n\n` +
    `Seu item *"${params.descricao}"* está sob custódia de ${params.custodianteNome}.\n\n` +
    `Aguardando retirada por ${params.destinatarioNome}.`
  );
}

// DELIVERY — Link de rastreamento para o cliente
export function msgDeliveryRastreamento(params: {
  estabelecimentoNome: string;
  descricao: string;
  linkRastreamento: string;
}): string {
  return (
    `🛵 *${params.estabelecimentoNome}*\n\n` +
    `Seu pedido "${params.descricao}" saiu para entrega!\n\n` +
    `Acompanhe em tempo real:\n` +
    `${params.linkRastreamento}\n\n` +
    `_Você receberá alertas quando o entregador estiver chegando._`
  );
}

// DELIVERY — Entregador na portaria
export function msgDeliveryNaPortaria(params: {
  estabelecimentoNome: string;
  descricao: string;
  linkConfirmacao: string;
}): string {
  return (
    `🔔 *${params.estabelecimentoNome}*\n\n` +
    `Seu pedido chegou! O entregador está no local com:\n` +
    `"${params.descricao}"\n\n` +
    `Confirme o recebimento:\n` +
    `${params.linkConfirmacao}`
  );
}

// CORE — Achei seu objeto (quem encontrou avisa o dono)
export function msgAcheiSeuObjeto(params: {
  tituloObjeto: string;
  linkObjeto: string;
  localOndeAchou?: string;
}): string {
  return (
    `👋 Olá! Encontrei um objeto que pode ser seu registrado no Backfindr:\n\n` +
    `*"${params.tituloObjeto}"*\n\n` +
    (params.localOndeAchou ? `📍 Encontrei em: ${params.localOndeAchou}\n\n` : '') +
    `Veja mais detalhes:\n` +
    `${params.linkObjeto}\n\n` +
    `_Se for seu, me avise e combinamos a devolução._`
  );
}

// CORE — Compartilhar objeto perdido em grupos
export function msgCompartilharPerdido(params: {
  tituloObjeto: string;
  descricao?: string;
  linkObjeto: string;
  local?: string;
}): string {
  return (
    `🔍 *PERDIDO — ${params.tituloObjeto}*\n\n` +
    (params.descricao ? `${params.descricao}\n\n` : '') +
    (params.local ? `📍 Local: ${params.local}\n\n` : '') +
    `Se encontrar, escaneie o QR Code ou acesse:\n` +
    `${params.linkObjeto}\n\n` +
    `_Publicado via Backfindr · plataforma de recuperação de objetos_`
  );
}

// SUPORTE — Usuário abre ticket via WhatsApp
export function msgSuporte(params: {
  userEmail: string;
  assunto: string;
}): string {
  return (
    `Olá, preciso de ajuda com o Backfindr.\n\n` +
    `📧 E-mail: ${params.userEmail}\n` +
    `📋 Assunto: ${params.assunto}`
  );
}
