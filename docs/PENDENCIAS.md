# Pendências e Roadmap — Backfindr

> Status: 🔴 Pendente | 🟡 Em andamento | ✅ Concluído

---

## ⚠️ AÇÃO NECESSÁRIA — Chave OpenAI

O **bot Findr** foi implementado e está em produção, mas opera com fluxo guiado pré-programado.
Para ativar respostas com **IA real** e cadastro totalmente conversacional:

1. Acesse: https://platform.openai.com/api-keys
2. Crie uma nova chave de API
3. Adicione como variável de ambiente no Vercel:
   - URL: https://vercel.com/marcosmakarara-6287s-projects/backfindr/settings/environment-variables
   - Nome: `OPENAI_API_KEY`
   - Valor: `sk-...` (sua chave)
4. Faça redeploy do projeto

Custo estimado: **menos de R$ 0,01 por conversa** (modelo `gpt-4o-mini`).

---

## Melhorias de Alta Prioridade

| # | Melhoria | Status | Descrição |
|---|----------|--------|-----------|
| 1 | **Redesign Premium da Home Page** | ✅ Concluído | Mockup interativo no Hero, seção emocional, seção Pets, seção Empresas, animações fade-in |
| 2 | **Estabilidade do Chat** | ✅ Concluído | Chat usa HTTP polling a cada 3s. Hook `useChat.ts` legado (WebSocket) removido do repositório |
| 3 | **Painel Business (funcionalidades)** | ✅ Concluído | Painel `/dashboard/business` criado com analytics de ativos, breakdown por status/categoria e lista de ativos recentes. Visível apenas para plano `business` |
| 4 | **Matching Geoespacial** | ✅ Concluído | Fórmula de Haversine implementada em SQL. Candidatos pré-filtrados por raio de 50km antes do scoring. Sem dependência de PostGIS |

---

## Melhorias de Média Prioridade

| # | Melhoria | Status | Descrição |
|---|----------|--------|-----------|
| 5 | **Compressão de Imagens** | ✅ Concluído | Compressão automática client-side com Canvas API (max 1200px, JPEG 82%) antes do upload |
| 6 | **Filtros Avançados no Mapa** | ✅ Concluído | Filtros por status, categoria, período e raio de distância com geolocalização do usuário |
| 7 | **Gamificação / Recompensas** | ✅ Concluído | Campos `reward_amount` e `reward_description` no banco, formulário, dashboard, scan e mapa |
| 8 | **Impressão de Etiquetas** | ✅ Concluído | Botão "Imprimir etiqueta 85×55mm" no dashboard — abre janela de impressão com QR Code e dados |
| 9 | **Compartilhamento Social** | ✅ Concluído | ShareModal com WhatsApp, Facebook, X, Instagram, TikTok, Telegram, Email e cópia de link. Disponível em objeto público, scan e dashboard |
| 10 | **Bot Assistente Findr** | ✅ Concluído | Widget flutuante em toda a plataforma. Fluxo guiado ativo. Slot OpenAI preparado (ver ação necessária acima) |

---

## Melhorias de Baixa Prioridade

| # | Melhoria | Status | Descrição |
|---|----------|--------|-----------|
| 11 | **Acessibilidade** | 🔴 Pendente | Aumentar contraste de textos secundários para leitura sob luz solar |
| 12 | **Landing Page para Pets** | 🔴 Pendente | Página separada com foco exclusivo em pets e coleiras com QR Code |
| 13 | **Monetização de Dados (B2G)** | 🔴 Pendente | Venda de insights anonimizados para prefeituras e shoppings |

---

## Correções Concluídas

| # | Correção | Data |
|---|----------|------|
| ✅ | URL da API hardcoded causando Network Error em domínios alternativos | 2026-04-13 |
| ✅ | Mapa não exibia objetos migrados do Webjetos (incompatibilidade de campos) | 2026-04-13 |
| ✅ | API retornava `objects` em vez de `items` | 2026-04-13 |
| ✅ | Todos os domínios configurados no Vercel e GoDaddy | 2026-04-13 |
| ✅ | Registros DNS do Resend adicionados no GoDaddy | 2026-04-13 |
| ✅ | Copy da Home Page atualizado com textos de impacto | 2026-04-13 |
| ✅ | Redesign premium da Home Page (Hero, Pets, Empresas, animações) | 2026-04-13 |
| ✅ | Painel Business criado no dashboard | 2026-04-13 |
| ✅ | Matching geoespacial otimizado com Haversine em SQL | 2026-04-13 |
| ✅ | Hook `useChat.ts` legado removido | 2026-04-13 |
| ✅ | Compartilhamento social (WhatsApp, Facebook, X, Instagram, TikTok, Telegram, Email) | 2026-04-13 |
| ✅ | Bot assistente Findr com fluxo guiado e slot OpenAI | 2026-04-13 |
| ✅ | Documentação viva `/docs` criada no repositório | 2026-04-13 |
| ✅ | Compressão automática de imagens client-side (Canvas API) | 2026-04-13 |
| ✅ | Filtros avançados no mapa (status, categoria, período, raio) | 2026-04-13 |
| ✅ | Sistema de recompensas completo (banco + APIs + UI) | 2026-04-13 |
| ✅ | Popup de resumo ao tocar em pontos do mapa | 2026-04-13 |
| ✅ | Impressão de etiquetas 85×55mm com QR Code | 2026-04-13 |
