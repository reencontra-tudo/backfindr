# Backfindr — Visão Geral da Plataforma

> Documento de referência técnica e de produto. Atualizado a cada avanço significativo.
> Última atualização: 2026-04-14

---

## Credenciais e Tokens de Acesso

| Serviço | Token / Chave | Observação |
|---------|--------------|------------|
| **Vercel API Token** | `vcp_36mc8Lb2k...cpN0buKwr` | Nome: `Backfindr-Manus-Deploy` — Sem expiração — Scope: `marcosmakarara-6287's projects` — **Valor completo salvo localmente** |
| **GitHub Token** | `ghp_1d9jevp1...45zqzf` | Org: `reencontra-tudo`, Repo: `backfindr` — **Valor completo salvo localmente** |
| **Repositório GitHub** | `https://github.com/reencontra-tudo/backfindr` | Branch principal: `main` |

---

## O que é o Backfindr

O Backfindr é uma plataforma SaaS de recuperação ativa de objetos perdidos. Diferente de simples "achados e perdidos", a plataforma combina QR Codes permanentes, matching por IA e chat mediado para fechar o ciclo completo de perda → encontro → devolução.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | Next.js 14 (App Router), React, TypeScript |
| **Estilo** | Tailwind CSS |
| **Banco de Dados** | PostgreSQL (via `pg` pool) |
| **Autenticação** | JWT (access + refresh tokens), Google OAuth, Facebook OAuth (ambos implementados em `/api/auth/google` e `/api/auth/facebook`) |
| **Pagamentos** | Stripe (Checkout + Webhooks) |
| **Email** | Resend (domínio: `send.backfindr.com.br`) |
| **Mapa** | Mapbox GL JS |
| **Deploy** | Vercel (região: `iad1`) |
| **Repositório** | GitHub (`backfindr-repo`) |

---

## Domínios Configurados

Todos os domínios estão com **Valid Configuration** no Vercel e certificados SSL emitidos.

| Domínio | Provedor DNS | Status |
|---------|-------------|--------|
| `backfindr.app` / `www.backfindr.app` | Vercel DNS (ns1/ns2.vercel-dns.com) | ✅ Valid |
| `backfindr.com` / `www.backfindr.com` | Vercel DNS (ns1/ns2.vercel-dns.com) | ✅ Valid |
| `backfindr.online` / `www.backfindr.online` | Vercel DNS (ns1/ns2.vercel-dns.com) | ✅ Valid |
| `backfindr.com.br` / `www.backfindr.com.br` | GoDaddy (A: 216.198.79.1, CNAME: 2559923009931a6d.vercel-dns-017.com) | ✅ Valid |
| `backfindr.vercel.app` | Vercel | ✅ Valid |

---

## Configuração de Email (Resend)

- **Domínio de envio:** `send.backfindr.com.br`
- **Região:** `sa-east-1` (São Paulo, Amazon SES)
- **Status:** Aguardando verificação DNS (registros adicionados no GoDaddy em 2026-04-13 — propagação pode levar até 48h)
- **Registros adicionados:**
  - `TXT resend._domainkey` → DKIM
  - `MX send` → `feedback-smtp.sa-east-1.amazonses.com` (prioridade 10)
  - `TXT send` → `v=spf1 include:amazonses.com ~all`

---

## Estrutura de Rotas

### Páginas Públicas
| Rota | Descrição |
|------|-----------|
| `/` | Home Page (landing page) |
| `/map` | Mapa público com objetos perdidos/achados |
| `/pricing` | Página de planos e preços |
| `/auth/login` | Login (email/senha + Google) |
| `/auth/register` | Cadastro de novo usuário |
| `/auth/forgot-password` | Recuperação de senha |
| `/auth/reset-password` | Redefinição de senha |
| `/objeto/[code]` | Página pública de um objeto (SSR, com SEO) |
| `/scan/[code]` | Página de scan de QR Code (client-side) |
| `/u/[id]` | Perfil público de usuário |
| `/privacy` | Política de Privacidade |
| `/terms` | Termos de Uso |

### Área Logada (Dashboard)
| Rota | Descrição |
|------|-----------|
| `/dashboard` | Painel principal com resumo |
| `/dashboard/objects` | Lista de objetos cadastrados |
| `/dashboard/objects/new` | Cadastrar novo objeto |
| `/dashboard/objects/[id]` | Editar objeto |
| `/dashboard/matches` | Lista de matches da IA |
| `/dashboard/chat/[matchId]` | Chat mediado por match |
| `/dashboard/search` | Busca pública de objetos achados |
| `/dashboard/notifications` | Central de notificações |
| `/dashboard/settings` | Configurações da conta |
| `/dashboard/billing` | Gerenciamento de plano e pagamento |
| `/admin` | Painel administrativo (restrito por ADMIN_IDS) |

### API (Next.js Route Handlers)
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/v1/auth/register` | POST | Cadastro |
| `/api/v1/auth/login` | POST | Login |
| `/api/v1/auth/logout` | POST | Logout |
| `/api/v1/auth/refresh` | POST | Renovar token |
| `/api/v1/auth/forgot-password` | POST | Solicitar reset de senha |
| `/api/v1/auth/reset-password` | POST | Redefinir senha |
| `/api/v1/objects` | GET/POST | Listar/criar objetos (autenticado) |
| `/api/v1/objects/[id]` | GET/PUT/DELETE | Objeto individual (autenticado) |
| `/api/v1/objects/public` | GET | Listar objetos públicos (mapa) |
| `/api/v1/objects/scan/[code]` | GET | Buscar objeto por QR Code |
| `/api/v1/matches` | GET | Listar matches do usuário |
| `/api/v1/matches/[id]` | PUT | Confirmar/rejeitar match |
| `/api/v1/matching/run` | POST | Rodar matching manual |
| `/api/v1/chat/[matchId]/messages` | GET/POST | Mensagens do chat |
| `/api/v1/notifications` | GET | Listar notificações |
| `/api/v1/notifications/[id]` | PUT | Marcar como lida |
| `/api/v1/notifications/read-all` | POST | Marcar todas como lidas |
| `/api/v1/notifications/unsubscribe` | POST | Cancelar push |
| `/api/v1/users/me` | GET/PUT | Perfil do usuário logado |
| `/api/v1/users/[id]/public` | GET | Perfil público |
| `/api/v1/billing` | GET | Status do plano |
| `/api/v1/billing/status` | GET | Status da assinatura Stripe |
| `/api/stripe/checkout` | POST | Criar sessão de checkout |
| `/api/stripe/webhook` | POST | Webhook do Stripe |
| `/api/v1/admin/stats` | GET | Estatísticas (admin) |

---

## Planos de Preços

| Plano | Preço | Destaques |
|-------|-------|-----------|
| **Free** | R$ 0 | Uso básico, QR Code com marca d'água |
| **Pro** | R$ 19,90/mês | QR sem marca, histórico ilimitado, suporte prioritário, API access (em breve) |
| **Business** | R$ 149/mês | Tudo do Pro + até 10 usuários, painel B2B, relatórios, SLA, onboarding dedicado — contato via `business@backfindr.com` |

---

## Variáveis de Ambiente Necessárias (Vercel)

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | OAuth Facebook |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Segredo do webhook do Stripe |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | ID do preço Pro no Stripe |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token do Mapbox |
| `RESEND_API_KEY` | Chave da API do Resend |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública VAPID para push |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID |
| `ADMIN_IDS` | IDs de usuários administradores (separados por vírgula) |
| `NEXT_PUBLIC_API_URL` | URL base da API (ex: `https://www.backfindr.app`) |
