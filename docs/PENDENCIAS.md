# Pendências e Roadmap — Backfindr

> Status: 🔴 Pendente | 🟡 Em andamento | ✅ Concluído

---

## Melhorias de Alta Prioridade

| # | Melhoria | Status | Descrição |
|---|----------|--------|-----------|
| 1 | **Redesign Premium da Home Page** | 🟡 Em andamento | Mockup 3D, glassmorphism, seção de pets, animações elegantes |
| 2 | **Estabilidade do Chat** | 🟡 Parcialmente resolvido | O chat já usa HTTP polling a cada 3s (não WebSocket) na página de chat. O hook `useChat.ts` ainda referencia WebSocket mas não é usado na página principal. Avaliar remover o hook legado para evitar confusão |
| 3 | **Plano Business (funcionalidades)** | 🔴 Pendente | A página de pricing já exibe o plano Business (R$ 149/mês), mas as funcionalidades do painel B2B (gestão em lote, relatórios, até 10 usuários) ainda não estão implementadas no dashboard |
| 4 | **PostGIS para Matching** | 🔴 Pendente | Substituir cálculo matemático de distância por queries PostGIS nativas |

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
