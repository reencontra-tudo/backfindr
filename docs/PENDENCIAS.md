# Pendências e Roadmap — Backfindr

> Status: 🔴 Pendente | 🟡 Em andamento | ✅ Concluído

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
| 5 | **Compressão de Imagens** | 🔴 Pendente | Comprimir fotos de objetos antes do upload para reduzir custos de storage |
| 6 | **Filtros Avançados no Mapa** | 🔴 Pendente | Filtro por data de perda, raio de distância e tipo de objeto |
| 7 | **Gamificação / Recompensas** | 🔴 Pendente | Sistema para o dono do objeto oferecer recompensa pela devolução |
| 8 | **Impressão de Etiquetas** | 🔴 Pendente | Geração de PDF para impressão de etiquetas com QR Code |
| 9 | **Compartilhamento Social** | 🔴 Pendente | Botão para compartilhar objeto perdido em grupos de WhatsApp/Facebook |

---

## Melhorias de Baixa Prioridade

| # | Melhoria | Status | Descrição |
|---|----------|--------|-----------|
| 10 | **Acessibilidade** | 🔴 Pendente | Aumentar contraste de textos secundários para leitura sob luz solar |
| 11 | **Landing Page para Pets** | 🔴 Pendente | Página separada com foco exclusivo em pets e coleiras com QR Code |
| 12 | **Monetização de Dados (B2G)** | 🔴 Pendente | Venda de insights anonimizados para prefeituras e shoppings |

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
| ✅ | Documentação viva `/docs` criada no repositório | 2026-04-13 |
