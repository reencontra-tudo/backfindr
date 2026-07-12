# BACKFINDR — Documento Mestre
> Arquivo único de referência. Toda sessão deve começar lendo este arquivo COMPLETO.
> Localização canônica: `~/Downloads/backfindr-local/backfindr-main/BACKFINDR.md`
> Última atualização: 2026-07-12
> **REGRA DE MANUTENÇÃO: nunca usar `cat >>`. Sempre reescrever via Python.**

---

## 1. O QUE É O BACKFINDR

Plataforma SaaS brasileira com 4 produtos independentes que compartilham base de usuários, banco e infraestrutura.

Fundador solo: Marcos (Cido Menezes) — Guarulhos/SP
Repositório: `https://github.com/reencontra-tudo/backfindr` (branch: `main`)
Produção: `https://backfindr.com` / `https://backfindr.io`
Projeto anterior: Webjetos (2015) — migração planejada

---

## 2. OS 4 PRODUTOS

### P1 — Backfindr Core ✅ Principal
- Cadastro lost/found/stolen/returned, matching IA, QR Code, chat, notificações
- ActivityCenterCard com Sistema Vivo completo
- Boost conectado ao checkout MercadoPago
- Tela de sucesso com loop WhatsApp
- **Incompleto:** Social Posts automático, Moderação, BarcodeDetector portaria

### P2 — Backfindr B2B
- Portal `/parceiro/*` funcional, role `b2b_admin`
- **Pendente:** onboarding do parceiro (cadastro manual hoje), mensalidade

### P3 — Backfindr Condomínios
- PWA portaria `/portaria/[condominioId]` ✅, página morador `/condominio/[slug]` ✅
- **Pendente:** histórico encomendas morador, achados internos, relatório síndico, mensalidade

### P4 — Backfindr Delivery
- Backend pronto, rastreio `/delivery/[token]` ✅
- **Pendente:** dashboard remetente, interface entregador — ciclo ausente na UI

---

## 3. PREMISSAS ESTRATÉGICAS PERMANENTES

**Filosofia oficial:** "O Backfindr existe para aumentar as oportunidades de reencontro."

**Posicionamento:** sistema vivo de recuperação patrimonial (não plataforma de perdidos e achados)

**Princípio de monetização:** "O usuário nunca compra antes de acreditar."

**Pergunta que guia toda decisão:** "Isso aumenta a probabilidade de um objeto voltar para seu dono?"

1. **Marketplace de Recompensas** — usuário paga probabilidade de recuperação, não mídia
2. **Motor de Distribuição** — divulgação user-funded (redes sociais, push, grupos, ads)
3. **Intelligence Hub** — banco de ocorrências como produto B2B (seguradoras, prefeituras, condomínios)
4. **QR Code é o DNA do Objeto** — produto físico de entrada, status `protected` = prevenção
5. **Modelo de receita:** Impulsos avulsos / Assinatura preventiva / Auto / Pet / QR físico / B2B

**Regra permanente de produto — responder antes de qualquer feature:**
1. Qual comportamento do usuário queremos gerar?
2. Qual evento será gravado?
3. Como isso aumenta as oportunidades de reencontro?
4. Como isso aumenta o valor da empresa no longo prazo?

---

## 4. STACK TECNOLÓGICA

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Banco | PostgreSQL via `query()` em `@/lib/db` — NUNCA Supabase client direto |
| Auth | JWT + cookies (`access_token`), Google OAuth, Facebook OAuth |
| Pagamentos | MercadoPago + Stripe |
| Email | Resend (`send.backfindr.com.br`) |
| Mapa | Mapbox GL JS |
| Storage | Cloudflare R2 (`backfindr-media`) |
| Analytics | PostHog, GA4 |
| Deploy | Vercel (região `iad1`) — `pnpm` obrigatório, nunca npm |
| Automação | n8n no Railway (`https://n8n-production-b99a.up.railway.app`) |
| IA | `gpt-4o-mini` (texto) + `gpt-image-1` (imagem) |
| Cartaz | next/og + Sharp (fit:contain antes do Satori) |

---

## 5. REGRAS TÉCNICAS PERMANENTES

- **Deploy:** commit na `main` → Vercel auto-deploy. Ou `npx vercel --prod` direto.
- **Banco:** sempre `query()` de `@/lib/db`. DATABASE_URL via `npx vercel env pull`
- **Pacotes:** sempre `pnpm install`, nunca `npm install` — lockfile quebra deploy
- **Arquivos:** nunca perguntar ao Marcos onde está. Dar comando `find`/`cat`/`ls` para ele colar
- **Código está em `src/`**, não em `app/` diretamente
- **Vercel Hobby:** cron máximo 1x/dia — matching gerenciado pelo n8n no Railway
- **Heredoc no zsh:** não usar para arquivos TSX/código com backticks — usar Python com strings

---

## 6. AMBIENTE LOCAL

```bash
bash ~/Downloads/iniciar-backfindr.sh
cd ~/Downloads/backfindr-local/backfindr-main && pnpm dev  # porta 3003
# Admin: localhost:3003/admin/dashboard — admin@backfindr.com / admin123
```

---

## 7. DOMÍNIOS

`backfindr.com` ✅ principal | `backfindr.io` ✅ | `backfindr.app` ✅ | `backfindr.com.br` ✅

---

## 8. BANCO DE DADOS

**Tabelas principais:** users, objects, matches, object_events, municipalities, local_pages,
condominios, porteiros, unidades, encomendas, custodias, b2b_partners, entregas,
estabelecimentos, entregadores, analytics_snapshots, boosts, payment_settings, seo_content_seeds, community_posts

**Dados produção (27/06/2026):** 4.303 usuários | 2.019 objetos (58% veículos, 35% animais) | 1 boost vendido | 434 páginas SEO

**Tabela object_events** (criada 26/06/2026):
```sql
id, object_id, user_id, type, title, description,
source (system|owner|community|partner|admin|api|ai),
actor_type, actor_id, metadata JSONB, created_at
```
Índices: `idx_object_events_object_id_created_at`, `idx_object_events_type_created_at`, `idx_object_events_actor`

**Events helpers** (`src/lib/events.ts`): objectCreated, objectPublished, objectIndexed,
matchingStarted, matchingCompleted, matchFound, qrScanned, ownerNotified,
boostStarted, boostExpired, objectReturned, statusChanged

---

## 9. MODELO DE RECEITA

| Linha | Produto | Preço |
|-------|---------|-------|
| 1 | Impulso Básico / Plus / Alerta Máximo | R$9,90 / R$29,90 / R$69,90 |
| 2 | Assinatura Proteção | R$14,90/mês |
| 3 | Backfindr Auto | R$49,90 avulso / R$19,90/mês |
| 4 | Backfindr Pet + Coleira QR | R$19,90/mês / R$29,90 |
| 5 | QR físico (adesivo/tag/placa/coleira) | R$19,90–R$49,90 |
| 6 | B2B / Condomínios / Intelligence Hub | R$599–2.999/mês / R$2–5/unid / R$2k–15k |

---

## 10. SISTEMA VIVO — STATUS COMPLETO ✅

Todas as sprints concluídas em 26–27/06/2026:

| Sprint | O que faz | Status |
|--------|-----------|--------|
| A | ActivityCenterCard visível no dashboard | ✅ |
| B1 | Tabela object_events + events.ts | ✅ |
| 2 | Eventos matching plugados no /matching/run | ✅ |
| 3 | boost_started, status_changed, object_returned | ✅ |
| 4 | GET /api/v1/objects/[id]/events + card dados reais | ✅ |
| 5 | Countdown next_matching_at na UI | ✅ |

**Cron:** removido do vercel.json (Hobby limit). Matching via n8n Railway a cada 15min.
**CRON_SECRET:** já existe no Vercel há 39 dias ✅ — NÃO é pendência.

---

## 11. MOMENTOS DE CONVERSÃO — STATUS

| Momento | Gatilho | Local | Status |
|---------|---------|-------|--------|
| 1 — Ansiedade | Cadastro feito | Tela /sucesso | ✅ implementado |
| 2 — Crença | total_ai_runs >= 1 | ActivityCenterCard | ✅ implementado (commit 2ad10c9) |
| 3 — Frustração Produtiva | ai_runs>=5 + days>=3 + matches=0 | ActivityCenterCard | ✅ implementado (commit c08d3c5) |

---

## 12. AUTOMAÇÃO n8n

- URL: `https://n8n-production-b99a.up.railway.app`
- Workflow AutoPost Facebook: 4 posts/dia, 7 nichos, gpt-image-1 → R2 → Facebook + Instagram
- SEO Content Engine: cron 9h diário, tabela seo_content_seeds (46 seeds, esgotam ~11/08/2026)
- Instagram @backfindroficial: 5 nichos (protect excluído pelo nó If) ✅
- **Tokens expiram ~30/07/2026** — Facebook pages + Instagram user token

**Facebook pages:** pet `1058341297366140` | celular `472039546624261` | bicicleta `301459970061606` | veículo `607774492681517` | geral+protect `229182413876628`
**R2:** bucket `backfindr-media`, `autopost/{timestamp}.jpg`

---

## 13. SEO

- 434 páginas publicadas (62 municípios × 7 categorias) ✅
- Cartaz: 3 formatos (square/vertical/A4) com Sharp + next/og ✅
- Botão "Baixar Cartaz" área pública → A4 ✅
- seo_content_seeds: 46 seeds, pipeline diário ativo ✅

---

## 14. VARIÁVEIS DE AMBIENTE (Vercel)

DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, FACEBOOK_APP_ID/SECRET,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
NEXT_PUBLIC_MAPBOX_TOKEN, RESEND_API_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY,
VAPID_PRIVATE_KEY, ADMIN_IDS, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL,
SERPAPI_KEY, OPENAI_API_KEY, MP_ACCESS_TOKEN, CRON_SECRET ✅

---

## 15. CONSELHO BACKFINDR

Estrutura de governança do produto instituída em 29/06/2026.

| Conselheiro | Papel | Responsabilidade |
|---|---|---|
| Marcos | Fundador e Presidente | Visão, decisão final, estratégia, mercado |
| Gil | Estratégia de Produto e Narrativa | Filosofia, UX, psicologia, branding, negócios |
| Claudio | Engenharia | Arquitetura, código, escalabilidade, antifraude |

**Regra de ouro do Conselho:** nenhuma promessa entra na comunicação sem que o produto a entregue hoje, em produção, de forma estável.

**Filtro permanente de coerência (Gil):**
1. Isso fortalece ou enfraquece a missão do Backfindr?
2. Isso aumenta as oportunidades de reencontro?
3. Isso aumenta a confiança entre desconhecidos?
4. Isso mantém a linguagem que estamos construindo?

---

## 16. IDENTIDADE DA MARCA — STATUS

**Documentos fundadores** (commit 873bef5 — 29/06/2026):
- `docs/brand/RECEPCAO.md` — arquitetura e textos da Recepção v1
- `docs/brand/MANIFESTO.md` — princípios editoriais e filosofia
- `docs/brand/JORNADA_DO_REENCONTRO.md` — narrativa institucional completa

**A Recepção v1** — aprovada por unanimidade em 29/06/2026:
- Substitui a landing tradicional como porta de entrada principal
- Pergunta central: "O que aconteceu?"
- Três jornadas: Perdi ou fui roubado / Encontrei alguma coisa / Quero proteger meus bens
- Portal de acolhimento: "Conheça o Backfindr"
- Rodapé: "Cada história é única. Vamos seguir esse caminho com você."
- 5ª porta (verificar procedência — IMEI/QR/chassi): registrada para fase futura

**A Jornada do Reencontro** — reposicionada como manifesto institucional:
- Uso: investidores, prefeituras, imprensa, propostas comerciais, vídeo institucional
- NÃO é mais a landing principal — é a narrativa da jornada "Conheça o Backfindr"

**Fase atual da Recepção:**
- Fase 1 ✅ — Recepção aprovada conceitualmente
- Fase 2 — Jornada "Perdi ou fui roubado" (próxima)
- Fase 3 — Jornada "Encontrei alguma coisa"
- Fase 4 — Jornada "Quero proteger meus bens"
- Fase 5 — Jornada "Conheça o Backfindr"

---

## 17. PRIORIDADES ABERTAS (29/06/2026 — fonte única de verdade)

### 🔴 Alto
- (nenhuma pendência crítica no momento)

### 🟡 Médio
- **Tokens Meta expiram ~30/07/2026**: renovar Facebook pages + Instagram user token
- **Seeds SEO**: 46 seeds esgotam ~11/08/2026 — reabastecer antes
- **Recepção v1**: implementar em React no produto real (próxima sessão)
- **GSC**: verificar canonicals /achados-perdidos, relatório indexação
- **Google Business**: data abertura travada em 2010 → corrigir para 2026
- **Loop WhatsApp**: revisar sucesso/page.tsx + ShareModal.tsx

### 🟢 Baixo
- Email reativação para 14 usuários reais de 2026
- MarketplaceOS: R$ NaN pricing, broken ML URLs, botão Novo anúncio redirect
- P2 B2B: onboarding parceiro, mensalidade
- P3 Condomínios: histórico encomendas, achados internos, relatório síndico
- P4 Delivery: dashboard remetente, interface entregador
- Imagem padrão por categoria quando objeto sem foto

### ✅ Resolvidos — NÃO reabrir
- CRON_SECRET: existe no Vercel há 39 dias
- Sistema Vivo completo (Sprints A, B1, 2, 3, 4, 5)
- Momento 1 (Ansiedade): tela de sucesso ✅
- Momento 2 (Crença): ActivityCenterCard ✅
- Cron vercel.json: removido (Hobby limit), n8n gerencia
- 434 páginas SEO publicadas
- Cartaz 3 formatos funcionando
- Matching automático no POST /objects ✅
- 6 índices Supabase executados ✅
- Instagram autopost 5 nichos ✅
- Cloudflare R2 configurado ✅
- moderation_blocked n8n: resolvido
- Momento 3 (Frustração Produtiva): ActivityCenterCard commit c08d3c5
- Checkout success: card Sistema Vivo + labels + BOOST_NAMES
- Pricing copy: alinhado com filosofia do produto
- ActivitySummary: estado honesto com horario cron
- BACKFINDR_INTELLIGENCE.md: constituicao fundacional commit 83104aa
- Recepção v1: aprovada por unanimidade, documentos fundadores commit 873bef5
- Bug de login corrigido (11-12/07/2026): schema zod exigia mínimo 8 caracteres na senha do LOGIN (deveria valer só para cadastro/troca), travando usuários com senha antiga mais curta; interceptor axios forçava reload em qualquer 401, inclusive senha errada no login, apagando a mensagem de erro antes do usuário conseguir ler. Corrigido em `src/app/auth/login/page.tsx` e `src/lib/api.ts`. Validado local: senha antiga mostra erro fixo na tela, senha nova loga normalmente.

---

## 18. PROTOCOLO DE SESSÃO

### Início obrigatório
```bash
cd ~/Downloads/backfindr-local/backfindr-main
cat BACKFINDR.md
git log --oneline -10
```

### Durante
- `cat` do arquivo antes de editar qualquer coisa
- `pnpm` sempre, nunca `npm`
- Commitar após cada mudança validada
- NUNCA declarar "feito" sem verificar no código

### Fim — atualizar este arquivo
```bash
python3 << PYEOF2
path = '/Users/macos/Downloads/backfindr-local/backfindr-main/BACKFINDR.md'
with open(path, 'w') as f:
    f.write("""conteudo_novo""")
PYEOF2
git add BACKFINDR.md
git commit -m "docs: BACKFINDR.md atualizado YYYY-MM-DD"
git push origin main
```

---

## 19. HISTÓRICO DE SESSÕES (resumo)

| Data | Principais entregas |
|------|-------------------|
| 21/06 | Diagnóstico geral, modelo receita, índices Supabase |
| 22/06 | Instagram autopost, R2, token Meta longa duração |
| 23/06 | SEO Content Engine (n8n + seeds), Google Business, cartaz dark hero |
| 24/06 | Cartaz 3 formatos funcionando, botão A4 área pública |
| 25/06 | Sharp + next/og definitivo, cartaz quadrado redesenhado |
| 26/06 | Sistema Vivo fundação: object_events, events.ts, ActivityCenterCard, Sprint A+B1 |
| 27/06 manhã | Sprints 2+3+4+5: matching events, endpoint, countdown, cron |
| 27/06 tarde | Momento 2 (Crença) implementado, fix sintaxe ActivityCenterCard, reorganização BACKFINDR.md |
| 27/06 noite | Momento 3, checkout success Sistema Vivo, pricing copy, ActivitySummary, BACKFINDR_INTELLIGENCE.md fundacional |
| 28/06 | Comunidade: embed YouTube (getEmbedUrl + Shorts), HTML no body (rehype-raw), thumbnail automático no card |
| 29/06 | Conselho instituído (Marcos/Gil/Claudio), Recepção v1 aprovada, docs/brand criado (commit 873bef5) |
| 11-12/07 | Fix login: removido min(8) do schema de senha no login; interceptor axios não força mais reload em 401 de /auth/login e /auth/refresh |

### Sessão 08/07/2026 — Correção RLS (Security Advisor)

- Advisor reportou 2 erros críticos: `public.seo_content_seeds` e `public.object_events` com RLS desativado (acesso público total via URL do projeto).
- Ativado RLS em ambas: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Confirmado que o backend (`src/lib/db.ts`) usa conexão direta via `pg.Pool` com usuário `postgres.trfklsdbsnmybsknjval` (pooler Supabase) — usuário dono das tabelas, bypassa RLS automaticamente. Escrita em `object_events` via `recordEvent()` (`src/lib/events.ts`) não é afetada.
- Criadas policies de SELECT:
  - `seo_content_seeds_select_public`: leitura pública (`USING (true)`) — conteúdo de SEO sem dono.
  - `object_events_select_own`: usuário só lê eventos de objetos que possui, via join com `public.objects.user_id = auth.uid()`.
- **Pendente para próxima sessão:** confirmar no Security Advisor que os 2 erros somem ("0 errors"), testar páginas de SEO local e Activity Center em produção para garantir que a leitura pública não foi afetada.
