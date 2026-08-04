# BACKFINDR — Documento Mestre
> Arquivo único de referência. Toda sessão deve começar lendo este arquivo COMPLETO.
> Localização canônica: `~/Downloads/backfindr-local/backfindr-main/BACKFINDR.md`
> Última atualização: 2026-07-21
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

**Redirects** (confirmado ao vivo via curl em 30/07/2026): `backfindr.com.br` → 308 → `backfindr.com` | `www.backfindr.com.br` → 308 → `backfindr.com` | `www.backfindr.com` → 307 → `backfindr.com`. Configurado no dashboard da Vercel (Project → Settings → Domains), fora do código.

**E-mail em backfindr.com.br** (ImprovMX, plano free — confirmado via `dig` em 30/07/2026):
- MX no apex: `mx1.improvmx.com` (prioridade 10), `mx2.improvmx.com` (prioridade 20)
- Alias wildcard: `financeiro@`, `suporte@`, `contato@` (e qualquer prefixo) encaminham para o Gmail principal
- TXT SPF no apex (confirmado via `dig` em 31/07/2026): `v=spf1 include:spf.improvmx.com ~all` — suporta o e-mail forwarding do ImprovMX
- Sem conflito com `send.backfindr.com.br` (SPF do Resend via Amazon SES, `v=spf1 include:amazonses.com ~all`) — hosts DNS diferentes (apex vs subdomínio), cada um com seu próprio registro SPF independente, verificado

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

**Auditoria estratégica de produto** (adicionado em 29/07/2026):
- `docs/PRODUCT_AUDIT_V1.md` — missão, visão, filosofia de produto, critérios de avaliação de novas funcionalidades, auditoria da jornada do usuário (landing, fluxo Perdi, cadastro, cadastro de objeto)

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
- **Google Business**: data abertura travada em 2010 → corrigir para 2026
- **Decisão pendente: ativar sistema de reativação?** Cron `/api/v1/cron/reactivation` existe e envia dicas personalizadas por categoria (v2), mas a tabela `reactivation_emails` que ele grava **nunca foi criada em produção** — parece ter sido escrito mas nunca ligado (sem cron do Vercel, sem workflow n8n disparando). Antes de estender esse fluxo (ex.: lembrete de compartilhar de novo após 3 dias sem match, cogitado na sessão do Loop WhatsApp), decidir: ativar o cron como um todo (criar a tabela, plugar disparo) ou descartar essa peça do sistema
### 🟢 Baixo
- Enriquecer as 434 páginas SEO local com eventos anuais regionais (ex.: Festa do Pêssego em Mogi, Festa da Uva em Ribeirão Pires) via UPDATE em tips_content
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
- 6 índices Supabase executados ✅ (idx_users_created_at, idx_objects_created_at, idx_objects_status, idx_objects_user_id, idx_matches_created_at, idx_notifications_type — reconfirmados via pg_indexes em 29/07/2026)
- Canonical tags padronizadas para backfindr.com em 26 arquivos (commit 22022cb, 29/07/2026)
- Redirect de backfindr.com.br para backfindr.com configurado no Vercel e confirmado via curl (30/07/2026) — ver seção 7
- Remetente de e-mail padronizado para noreply@backfindr.com.br em email.ts, boost-notifications/route.ts e admin/emails/route.ts (commit c969e27, 29/07/2026) — domínio verificado no Resend
- Loop WhatsApp — copy magnética (não genérica) no ShareModal.tsx + rastreamento de origem via ?via=whatsapp_share (commit 7f4b683, 30/07/2026); evoluído com Web Share API nativa como método principal + fallback com "Copiar legenda" e tratamento correto do Facebook (commit e661b93, 31/07/2026). Parte 3 (lembrete de reforço) ficou de fora, ver decisão pendente sobre sistema de reativação acima
- Evento de conversão GA4 `ocorrencia_publicada` na tela de sucesso (commit 4a3b439, 01/08/2026) — base pra marcar conversão no GA4 e importar pro Google Ads
- Google Ads API — Fase 1 concluída (commit 7a00975, 02/08/2026): client REST + rota de diagnóstico funcionando. Campanha "SBF | Pesquisa | Objetos Perdidos | BR" diagnosticada — LIMITED por fase de aprendizado normal (BIDDING_STRATEGY_LEARNING) + janela curta de datas, não configuração quebrada. Fase 2 (mutações) não é necessária por ora — ver seção "Google Ads API" para detalhes técnicos e achados não-óbvios da API
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
- Rastreamento de origem de cadastro implementado (12/07/2026): PostHog estava capturando sessões anônimas mas nunca identificava usuários (0 persons), pois `analytics.identify()` nunca era chamado — corrigido em `login/page.tsx` e `register/page.tsx`, chamando identify + eventos `sign_up`/`login` logo após autenticação. Adicionalmente, criado `src/middleware.ts` que captura UTM (source/medium/campaign/content/term) e referrer na primeira visita, gravando em cookie `bf_acquisition` (90 dias, first-touch); `register/route.ts` lê o cookie e grava em novas colunas na tabela `users` (migration `005_user_acquisition_source.sql`, já aplicada em produção via Supabase SQL Editor). Validado ponta a ponta: PostHog mostrando pessoa identificada com geolocalização/dispositivo, e banco gravando utm_source/utm_medium/utm_campaign corretamente.
- Dashboard de origem dos cadastros implementado direto no `/admin/analytics` (12/07/2026): nova seção "Últimos cadastros — origem" (tabela com nome, e-mail, utm_source/medium, campanha, referrer, data) e "Cadastros por fonte (90 dias)" (barra de proporção por utm_source). API `route.ts` ganhou queries `recentSignupSources` e `utmSourceBreakdown`, expostas em `acquisition.recent_signups` e `acquisition.by_source`. Objetivo: Marcos conseguir ver origem de cadastros sem sair do sistema nem logar em Supabase/PostHog. Validado em produção — 190 cadastros históricos aparecem como "direto/desconhecido" (esperado, pré-tracking), 1 teste com UTM simulado (instagram/social) aparece corretamente.
- Regra de senha padronizada entre cadastro e reset (12/07/2026): cadastro exigia mínimo 8 caracteres + 1 maiúscula + 1 número; reset exigia só 8 caracteres — inconsistência identificada por Marcos após confusão de login. Ambos agora exigem apenas 8 caracteres (plataforma não lida com ativos de valor, fricção extra não se justifica). Alterado em `register/page.tsx`.
- Workflow n8n "Backfindr SEO Content — Daily Post" corrigido (21/07/2026): parado desde 28/06 por erro de SQL no node "Inserir post" — expressões separadas por vírgula em `queryReplacement` quebravam sempre que o corpo do post (texto em português) continha vírgulas, desalinhando os parâmetros $1-$11. Corrigido trocando para uma única expressão que retorna array JS (`{{ [$json.slug, $json.title, ...] }}`), eliminando a dependência de split por vírgula. Corrigido e publicado via conector n8n MCP (não mais só pela interface visual). Validado com execução de produção real (post inserido com sucesso).
- Conector n8n MCP configurado no Claude (21/07/2026): permite buscar workflows, ver execuções, editar parâmetros de nodes e publicar direto pelo chat, sem precisar da interface visual do n8n. Requer habilitar "Enable MCP access" em cada workflow individualmente (Editor → menu do workflow). Testado com sucesso nos workflows de Comunidade e AutoPost.
- Workflow n8n "Backfindr AutoPost — Facebook" ajustado (21/07/2026): reduzida frequência de 3x/dia (a cada 8h, apesar do node se chamar "Cron 4h") para 2x/dia (a cada 12h), a pedido de Marcos devido a baixo engajamento e sensação de posts repetitivos. Prompt de geração de imagem (node HTTP Request → gpt-image-1) ganhou variação aleatória de enquadramento (6 opções: close-up, plano aberto, ângulo de cima, altura dos olhos, através de vidro, contraluz) e iluminação (4 opções), além do clima que já existia — reduz a sensação de imagens repetitivas mesmo com temas parecidos. Publicado; efeito só visível a partir do próximo ciclo do cron.
- Landing page `/comecar` criada (21/07/2026): página dedicada para tráfego pago (anúncios/reels), sem menu nem scroll — reaproveita visual exato do hero da home (título, 4 cards Perdi/Encontrei/Roubado/Prevenir, gradiente, grid pattern). Título alterado para "O que aconteceu?" (neutro para os 4 casos, ao invés de "Perdeu algo?" que só falava para quem perdeu) — mesma lógica da Recepção v1 aprovada anteriormente. Inclui link "Ver mapa ao vivo" (prova social). Responsividade reforçada para telas baixas (iPhone SE) com `min-h-screen` + scroll de segurança em mobile, `h-screen` sem scroll em telas maiores. Arquivo: `src/app/comecar/page.tsx`. Publicado em produção: `backfindr.com/comecar`.
- Landing `/comecar` refinada com feedback de copy/conversão de Marcos (21/07/2026): copy dos 4 cards alinhada à linguagem usada nos vídeos de anúncio ("Perdi alguma coisa"/"Encontrei alguma coisa" ao invés de "Perdi algo"/"Encontrei algo"; subtextos com "Cadastre" repetido, tom mais emocional/forte). Adicionada frase de proposta de valor abaixo do título ("Cada cadastro aumenta uma oportunidade de reencontro"). Subtítulo longo trocado por "Escolha uma opção para começar" (menos leitura). Botão do mapa renomeado para "Ver ocorrências próximas" (mais descritivo). Rodapé trocado de instrução para prova social: "+4.300 pessoas já utilizam o Backfindr" (número real do Analytics). Cards reduzidos ~10% (ícone, texto, padding). Área de toque de todos os links (4 cards + botão mapa) expandida ~6px além da borda visível via `after:-inset-1.5`, sem alterar layout visual — melhora usabilidade mobile sem risco de sobreposição entre cards vizinhos (gap de 10px preservado com margem de segurança).
- ATENÇÃO — armadilha de sessão (21/07/2026): um round de edições da landing /comecar foi documentado no BACKFINDR.md mas o `cat > page.tsx << EOF` correspondente não foi executado antes do commit — `git commit` retornou "nothing to commit" (arquivo já batia com a versão anterior). Lição: sempre confirmar `git diff <arquivo>` mostra as mudanças esperadas ANTES de assumir que um commit documentado foi de fato aplicado. Corrigido na sessão seguinte após Marcos notar divergência entre o que via em produção e o que estava documentado.
- Landing `/comecar` — segundo round de polimento (21/07/2026): subtítulo "Escolha uma opção para começar" aumentado (text-sm→text-base, ~15%) e contraste elevado (white/45→white/55) para leitura mais rápida. Subtextos dos 4 cards com contraste elevado (white/45→white/60), especialmente "Ajude a encontrar o dono" que ficava apagado em telas com brilho baixo. Removidos parênteses do subtexto do card "Perdi": "Cadastre agora (leva menos de 30 segundos)" → "Cadastre agora. Leva menos de 30 segundos." (mais limpo visualmente). Frase de prova social do rodapé refinada após análise de precisão factual — descartadas "já confiaram" (pressupõe confiança não observável) e "já aumentaram suas oportunidades" (promete resultado não comprovável individualmente); escolhida "Junte-se a mais de 4.300 pessoas que já aumentam as oportunidades de reencontro" (comunica rede colaborativa sem prometer resultado individual).
- Pendências registradas para decisão futura baseada em dados, não opinião (21/07/2026): (1) testar A/B remoção do botão "Ver ocorrências próximas" na /comecar — Marcos questionou se compete com os 4 CTAs principais para quem vem de anúncio; (2) considerar landings segmentadas por intenção (`/perdi` com título "Você perdeu alguma coisa?" mostrando só Perdi+Roubado; `/encontrei` só Encontrei; `/protect` só Protect) para manter a mensagem do anúncio consistente na landing — explicitamente adiado por Marcos até coletar dados reais da versão atual de /comecar; (3) página /map sem indicador de carregamento visível — pode parecer travada em conexões lentas ou primeira carga do Mapbox, ainda não investigado a fundo (só reproduzido em ambiente local, não confirmado como bug real em produção).
- Auditoria de tracking + instalação de Microsoft Clarity e Meta Pixel (21/07/2026): confirmado que Backfindr tinha GA4 e PostHog, mas NÃO tinha Meta Pixel, GTM, Clarity nem Search Console. Instalado Microsoft Clarity (gravação de sessão + heatmap) — projeto criado em clarity.microsoft.com, Project ID `xpzich5od9`, script inserido em `layout.tsx`, variável `NEXT_PUBLIC_CLARITY_PROJECT_ID` configurada no Vercel (Production/Preview/Development, não-sensível). Instalado Meta Pixel com 4 eventos: `PageView` (automático em todo o site), `ViewContent` (na landing `/comecar`), `Lead` (ao concluir cadastro em `register/page.tsx`), `Purchase` (ao confirmar Boost em `checkout/success/client.tsx`, usando `amount_paid` real do banco). Pixel criado como conjunto de dados novo "Backfindr Site" (ID `882137184519436`) dentro do Business Manager "Backfindr" — decisão deliberada de não reaproveitar o pixel existente "Backfindr AutoPost" (ID `1286158296941920`), que é usado para outra finalidade. Variável `NEXT_PUBLIC_META_PIXEL_ID` configurada no Vercel. Processo de criação do pixel no Facebook foi instável (assistente "Conectar dados" travava repetidamente sem criar nada); caminho que funcionou: Configurações do Negócio → Fontes de dados → Conjuntos de dados e pixels → Adicionar → Criar novo conjunto de dados. Validado localmente: `typeof fbq` retorna `'function'`, sem erros no console.
- Status atual de tracking do Backfindr: GA4 ✅, PostHog ✅, Microsoft Clarity ✅, Meta Pixel ✅ (4 eventos). Ainda sem: GTM, Search Console.

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
| 19/06 | Navegação de retorno (botão "← Voltar") nas páginas SEO local de cidade e categoria (commit 262d6f0) |
| 20–23/06 | SEO local das 7 capitais publicado — Salvador, Fortaleza, BH, Curitiba, Recife, Porto Alegre, Brasília (7 páginas cada; janela estimada por evidência indireta — sem commit git, confirmado via consulta ao banco de produção, não é a data exata de execução) |
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
| 12/07 | PostHog identify no login/cadastro (analytics.identify + sign_up/login); middleware de captura UTM/referrer first-touch; migration 005 (colunas de origem em users) aplicada em produção |
| 12/07 (cont.) | Seção "Origem dos Cadastros" no /admin/analytics (tabela + breakdown por fonte); regra de senha padronizada (min 8 chars) entre cadastro e reset |
| 21/07 | Fix definitivo do workflow Comunidade (parâmetros SQL via array JS); conector n8n MCP configurado no Claude; AutoPost reduzido para 2x/dia com prompt de imagem variado; landing /comecar criada para tráfego pago |
| 21/07 (cont.) | Landing /comecar refinada: copy alinhada aos vídeos de anúncio, proposta de valor, prova social, área de toque expandida (UX mobile) |
| 21/07 (cont. 2) | Segundo round de polimento na /comecar (contraste, tamanho de fonte, prova social refinada); pendências de A/B test e landings segmentadas registradas para decisão futura por dados |
| 21/07 (cont. 3) | Instalação de Microsoft Clarity (gravação de sessão + heatmap) e Meta Pixel (PageView, ViewContent, Lead, Purchase) em todo o site |
| 29/07 | Confirmados os 6 índices de performance Supabase — idx_users_created_at (users), idx_objects_created_at/idx_objects_status/idx_objects_user_id (objects), idx_matches_created_at (matches), idx_notifications_type (notifications) — via query direta pg_indexes no banco de produção; sem commit/migration rastreável mostrando a data real de criação (mesmo padrão de outras mudanças de schema aplicadas direto no SQL Editor) |
| 29/07 (cont.) | Corrigida inconsistência de canonical tags (causa provável do erro "página alternativa com tag canônica adequada" no GSC): 26 arquivos padronizados para o domínio único `https://backfindr.com`. 13 páginas de metadata (`/perdi`, `/achei`, `/roubado`, `/encontrei`, `/pet`, `/proteger`, `/faq`, `/terms`, `/map`, `/pricing`, `/buscar`, `/auth/login`, `/auth/register`) trocaram canonical/og:url de string absoluta `www.backfindr.com` para caminho relativo, herdando o `metadataBase` já correto do `layout.tsx` raiz. `objeto/[code]/page.tsx` tinha 3 constantes de URL redundantes, 2 com fallback errado para `backfindr.com.br` — consolidadas em 1. Criado `src/lib/constants.ts` (`APP_URL`) como fonte única para as demais URLs hardcoded (links de compartilhamento WhatsApp, QR Code de scan, fallbacks de rotas de API, 16 ocorrências em `src/lib/email.ts`). Validado: `tsc --noEmit` sem novos erros (14 pré-existentes idênticos antes/depois), `next build` compilou 106/106 páginas sem erro, 4 páginas testadas ao vivo localmente (faq/pricing/terms/buscar) com canonical correto, os 5 redirects (`/perdi` etc.) confirmados via curl, página de objeto real testada com canonical e JSON-LD apontando para backfindr.com, URLs geradas pelo QR/WhatsApp confirmadas HTTP 200 em produção, e as 8 funções de `email.ts` executadas de fato (Resend mockado, zero e-mail real enviado) confirmando HTML sem `www`/`.com.br`. Fora do escopo: domínio de e-mail remetente (`noreply@backfindr.com.br` em 2 arquivos) e redirect de `backfindr.com.br` no Vercel — registrados como pendências na seção 17 |
| 29/07 (cont. 2) | Padronizado remetente de e-mail para `noreply@backfindr.com.br` (commit c969e27) em `email.ts` (1 constante `FROM`, reutilizada nas 8 funções — não 16 ocorrências como inicialmente estimado) e mais 2 arquivos achados no mesmo escopo (`boost-notifications/route.ts`, `admin/emails/route.ts`), após confirmação de Marcos no dashboard do Resend de que `backfindr.com.br` é o domínio verificado (SPF/DKIM); `backfindr.com` exigiria upgrade pago. Validado com `tsc --noEmit` (mesmos 14 erros pré-existentes, `.next` limpo para descartar ruído de build artifact), `next build` 106/106, e Resend mockado confirmando `from` correto nas 8 funções sem nenhum e-mail real disparado |
| 30/07 | Fechadas as 2 pendências da seção 17 abertas na sessão anterior: (1) redirect de `backfindr.com.br` → `backfindr.com` confirmado ao vivo via curl (308, configurado no dashboard da Vercel, fora do código); (2) padronização do remetente de e-mail já registrada acima. Novo: e-mail de `backfindr.com.br` configurado via ImprovMX (plano free) — MX apex `mx1`/`mx2.improvmx.com` (prioridade 10/20) confirmados via `dig`, alias wildcard (`financeiro@`, `suporte@`, `contato@`, qualquer prefixo) encaminhando para o Gmail principal, sem conflito com o SPF do Resend em `send.backfindr.com.br` (nomes DNS distintos, confirmado). Teste de entrega real do forwarding feito por Marcos após o registro dos MX — sucesso confirmado (e-mail de teste chegou no Gmail principal). Verificação dos registros DNS foi feita nesta sessão via `dig`; o teste de envio em si é reportado por Marcos, não executado por ferramenta |
| 30/07 (cont.) | Loop de compartilhamento WhatsApp (commit 7f4b683): copy do `ShareModal.tsx` trocada de genérica (`${title}\n${url}`) para texto magnético por status (lost/stolen/found/protected), extraído para `src/lib/shareText.ts` a partir da lógica que já existia isolada em `sucesso/page.tsx`; todo link de WhatsApp passou a carregar `?via=whatsapp_share`, capturado em `objeto/[code]/page.tsx` e gravado como novo evento `Events.sharedLinkOpened`. De bônus, corrigido `https://backfindr.app/...` hardcoded (domínio fora do canônico) para `APP_URL` em 2 arquivos. Descoberta em paralelo: a tabela `reactivation_emails` usada pelo cron `/api/v1/cron/reactivation` nunca foi criada em produção — decisão de reaproveitar esse cron para o lembrete de reforço (Parte 3, não implementada) fica pendente de uma decisão maior sobre ativar ou não o sistema de reativação como um todo. Validado: tsc/build limpos, evento `shared_link_opened` confirmado gravado em produção (objeto real JDZ4BQFO) via teste ao vivo, texto magnético testado isoladamente em 5 cenários de status |
| 31/07 | ShareModal.tsx evoluído para Web Share API nativa como método principal (commit e661b93): diferenciação de origem entre `?via=native_share` (Web Share API genérica) e `?via=whatsapp_share` (botão WhatsApp direto no modal); novo botão "Copiar legenda" no fallback desktop; Facebook passou a copiar a legenda automaticamente pro clipboard antes de abrir o sharer (Meta bloqueia preenchimento via URL desde 2018) em vez de fingir suporte. Bônus: corrigido bug pré-existente onde `navigator.share` recebia `url` duplicado além do link já embutido em `text`. Incidente durante o teste: um clique com referência de elemento desatualizada (após scroll) acertou por engano o botão real "Avisar o dono que encontrei" no objeto de produção JDZ4BQFO, criando uma notificação in-app falsa pra um usuário real — confirmado que nenhum push/e-mail/SMS foi enviado (VAPID não configurado localmente + usuário sem inscrição push), só a linha no banco; notificação de correção enviada pelo mesmo canal, aprovada por Marcos antes do envio. Validado: tsc/build limpos, testado ao vivo em desktop (modal, "Copiar legenda" com toast confirmado, Facebook) e mobile (viewport 375x812, navigator.share mockado, chamada real capturada) |
| 31/07 (cont.) | Adicionado registro TXT SPF no apex de `backfindr.com.br` (`v=spf1 include:spf.improvmx.com ~all`) para suportar o e-mail forwarding do ImprovMX (financeiro@/suporte@/contato@) configurado na sessão anterior — confirmado via `dig` que não conflita com o SPF do Resend em `send.backfindr.com.br` (hosts DNS diferentes, cada um com registro próprio). Testado e funcionando |
| 01/08 | Evento de conversão GA4 `ocorrencia_publicada` implementado na tela de sucesso (commit 4a3b439) — `object_type` (categoria real do objeto) + `send_to` (via env var, não hardcoded). Testado criando usuário/objeto descartáveis via SQL + JWT de teste assinado localmente (sem tocar em conta real), confirmado via `window.dataLayer` disparando uma única vez. Dados de teste apagados após validação |
| 02/08 | Google Ads API — pesquisa e plano de automação (Fase 0-1, ver seção "Google Ads API" abaixo para detalhes completos) |
| 02/08 (cont.) | Google Ads API Fase 1 concluída (commit 7a00975): client REST + rota de diagnóstico da campanha SBF funcionando de ponta a ponta. Achado técnico: campaign_budget.amount_micros só existe para period=DAILY; orçamentos CUSTOM_PERIOD usam total_amount_micros — inicialmente pareceu bug (campo ausente), não era. Diagnóstico real: campanha em LIMITED por BIDDING_STRATEGY_LEARNING (fase de aprendizado normal) + janela curta de datas, orçamento R$100 total (R$20/dia × 5 dias) confirmado correto. Decisão do Marcos: não prosseguir para Fase 2 (mutações) — campanha não está quebrada, só aguardando a fase de aprendizado terminar |

### Sessão 08/07/2026 — Correção RLS (Security Advisor)

- Advisor reportou 2 erros críticos: `public.seo_content_seeds` e `public.object_events` com RLS desativado (acesso público total via URL do projeto).
- Ativado RLS em ambas: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Confirmado que o backend (`src/lib/db.ts`) usa conexão direta via `pg.Pool` com usuário `postgres.trfklsdbsnmybsknjval` (pooler Supabase) — usuário dono das tabelas, bypassa RLS automaticamente. Escrita em `object_events` via `recordEvent()` (`src/lib/events.ts`) não é afetada.
- Criadas policies de SELECT:
  - `seo_content_seeds_select_public`: leitura pública (`USING (true)`) — conteúdo de SEO sem dono.
  - `object_events_select_own`: usuário só lê eventos de objetos que possui, via join com `public.objects.user_id = auth.uid()`.
- **Pendente para próxima sessão:** confirmar no Security Advisor que os 2 erros somem ("0 errors"), testar páginas de SEO local e Activity Center em produção para garantir que a leitura pública não foi afetada.

### Google Ads API — Investigação, Plano e Fase 1 (02/08/2026)

**Motivação:** campanha "SBF | Pesquisa | Objetos Perdidos | BR" (conta Google Ads `468-452-7429`, ocid `27174836`) travada em "Qualificada (limitada)", zero impressões/cliques, apesar de horas de configuração manual pela UI. Suspeita: janela de datas curta (termina 05/08/2026) e/ou orçamento insuficiente. A conversão `ocorrencia_publicada` já está configurada e vinculada (GA4 propriedade Backfindr, ID `539806265`) — ver evento implementado no commit `4a3b439` acima.

**1. O que a Google exige (pesquisado nesta sessão, fontes ao final):**
- **Developer token**: obtido via API Center (`ads.google.com/aw/apicenter`) da conta Google Ads manager. Aceitar Termos, ter site da empresa funcionando, e-mail de contato monitorado (Google pode entrar em contato durante revisão).
- **Níveis de acesso**: Test Account (só contas de teste) → **Explorer Access** (novo em 2026 — ver abaixo) → Basic Access → Standard Access (sem limite de operações/dia).
- **🎯 Achado principal — Explorer Access**: tier intermediário lançado em 2026, **concedido automaticamente na maioria dos casos, sem aprovação formal**. Dá acesso de produção com 2.880 operações/dia. Exclui explicitamente: criação de conta (`CustomerService.CreateCustomerClient`), gerenciamento de usuários, ferramentas de planejamento (keyword planner, audience insights) e billing. **Não exclui** mutate de campanha/orçamento nem leitura de diagnóstico/recomendações — ambos parecem cobertos, a confirmar na prática assim que tivermos o token. Isso muda a expectativa de "dias de aprovação" (Basic/Standard, oficialmente até 5 dias úteis, com histórico de fila/atraso reportado em fev/2026) para **potencialmente horas**, já que Explorer costuma ser concedido de forma automática.
- **OAuth2**: criar OAuth Client ID tipo "Desktop app" no Google Cloud Console (mesmo projeto/conta), gerar refresh token com `access_type=offline` (via OAuth Playground ou script local, uma vez só).
- **Bibliotecas oficiais**: Python, Java, PHP, .NET, Ruby, Perl. **Não existe biblioteca Node.js/JavaScript oficial** — só um pacote comunitário não-oficial (`google-ads-api` no npm). Como o Backfindr é Next.js/TypeScript, a proposta é consumir a **REST API diretamente via `fetch`** (a API tem interface REST/JSON além do gRPC dos clients oficiais), mesmo padrão já usado no projeto para outras APIs externas (ex.: chamada direta à API do Resend em `forgot-password/route.ts`). Versão atual da API: v24.x (major versions saem a cada ~3 meses, cada uma com endpoint REST próprio e sunset em ~1 ano — vai exigir atualização periódica).

**2. Viabilidade — uma conta, um token:** Backfindr e M2RMenu **não são duas contas Google Ads distintas** — ambos usam a mesma conta `468-452-7429`. Logo, não há necessidade de tokens/OAuth separados por projeto: **um único developer token + uma única credencial OAuth (client ID/secret + refresh token) cobre os dois**. Developer token é como uma "licença" da empresa/conta manager — uma vez aprovado, funciona contra qualquer conta acessível pelo mesmo login Google, bastando trocar o `customer_id` (e `login_customer_id` se houver hierarquia MCC) em cada chamada.

**3. Plano de implementação (3 fases, nada implementado ainda):**
- **Fase 0 — só o Marcos pode fazer** (login real em conta Google, fora do alcance do Claude Code): (a) aplicar o developer token no API Center; (b) criar o OAuth Client ID (Desktop app) no Google Cloud Console; (c) gerar o refresh token (rodar um script simples uma única vez, localmente, que abre o fluxo OAuth no navegador).
- **Fase 1 — leitura de diagnóstico** (~1-2h de implementação, depois de ter as credenciais): novo `src/lib/googleAds.ts` com um client REST fino (token refresh automático) + uma rota admin que consulta `GoogleAdsService.Search` com os campos de `campaign`, `campaign_budget` e `recommendation` — resolve o "não precisar mais navegar manualmente pra ver problemas detectados".
- **Fase 2 — edição de orçamento e datas** (~1-2h): endpoint de mutate em `CampaignBudgetService`/`CampaignService` (update de `amount_micros`, `start_date`/`end_date`). Precisa de confirmação prática de que Explorer Access permite mutate (não está explicitamente proibido na doc, mas não está 100% documentado também).
- **Fase 3 — conversão**: como a conversão `ocorrencia_publicada` já está configurada e vinculada no GA4/Google Ads pela UI, aqui é só leitura/verificação via `ConversionActionService` — reaproveita o client da Fase 1.

**4. Variáveis de ambiente necessárias (a definir após Fase 0):**
```
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=   # conta manager, se houver hierarquia MCC
GOOGLE_ADS_CUSTOMER_ID=4684527429
```

**5. Estimativa de esforço:** Fase 0 é a Marcos (tempo variável — pode ser minutos se Explorer Access for auto-concedido, ou até 5 dias úteis se cair em revisão manual de Basic/Standard). Fases 1-3, depois de credenciais em mãos: 3-5h de trabalho de código no total.

**6. Fase 0 concluída (mesma sessão):** Marcos aplicou o developer token, criou o OAuth Client ID e gerou o refresh token — 4 credenciais entregues via chat (nunca coladas no histórico), gravadas em `.env.local`/`.env.example`. `GOOGLE_ADS_LOGIN_CUSTOMER_ID=7631795941` (MCC "Marcos Makarara"), `GOOGLE_ADS_CUSTOMER_ID=4684527429`.

**7. Fase 1 concluída (commit `7a00975`) — implementado, testado, funcionando:**
- `src/lib/googleAds.ts`: client REST (token OAuth com cache, `listAccessibleCustomers`, `gaqlSearch`). API real: **v25** (não v24 como estimado na pesquisa inicial — Google lança versão nova a cada ~3 meses).
- `src/app/api/v1/admin/google-ads/diagnostics/route.ts`: rota `GET` protegida por `requireSuperAdmin`, `?campaign=<nome>`.
- **Achado técnico #1**: `login-customer-id` **não deve ser enviado** quando o OAuth acessa a conta-alvo diretamente (não via delegação de MCC) — mesmo a MCC aparecendo em `listAccessibleCustomers`, enviá-la nesse header gera `403 USER_PERMISSION_DENIED`. Confirmado empiricamente testando as 3 variantes (sem header / MCC / própria conta).
- **Achado técnico #2**: em v25, `campaign.start_date`/`campaign.end_date` viraram `campaign.start_date_time`/`campaign.end_date_time` (breaking change da versão). Nomes de campo corretos confirmados via `GoogleAdsFieldService` (`googleAdsFields:search`), não só pela doc pública (que se mostrou desatualizada/incompleta nessa consulta específica).
- **Achado técnico #3**: `campaign_budget.amount_micros` só é populado quando `period=DAILY`. Para `period=CUSTOM_PERIOD` (ex.: R$/dia por N dias fixos), o campo fica **ausente da resposta mesmo selecionado corretamente na query** — pareceu bug de field mask, não era. O valor real está em `campaign_budget.total_amount_micros`. Vale lembrar disso em qualquer integração futura com orçamentos de período customizado.
- **Diagnóstico real da campanha "SBF | Pesquisa | Objetos Perdidos | BR"**: `primaryStatus: LIMITED`, `primaryStatusReasons: [BIDDING_STRATEGY_LEARNING, UNKNOWN]`, `startDateTime: 2026-07-31 23:06:30` → `endDateTime: 2026-08-05 23:59:59` (~5 dias), orçamento `totalAmountMicros: 100000000` (R$100 = R$20/dia × 5 dias, confirmado correto por Marcos), 0 cliques/impressões.
- **Conclusão e decisão**: campanha em fase de aprendizado normal (bidding strategy automatizada + janela curta), não configuração quebrada. Marcos decidiu **não prosseguir para Fase 2** (mutações de orçamento/data) por ora — nada pra corrigir. Revisitar em alguns dias pra ver se sai de LIMITED sozinha.
- **Nível de acesso do developer token (Basic/Standard/Explorer)**: não foi possível confirmar de forma conclusiva — não existe endpoint que retorne isso diretamente. Um teste `validate_only: true` num mutate (zero mudança real, mecanismo oficial do Google pra validação) resolveria isso, mas foi propositalmente adiado a pedido do Marcos já que Fase 2 não é necessária agora.
- Testado 2x via HTTP real no servidor local, autenticado com `super_admin` descartável criado e apagado só para o teste (mesmo padrão de cautela desde o incidente da sessão do ShareModal).

**Fontes consultadas (pesquisa web, 02/08/2026):**
- [Developer Token | Google Ads API](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)
- [Access Levels and Permissible Use | Google Ads API](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)
- [Google faces developer token application backlog as new API tier debuts](https://ppc.land/google-faces-developer-token-application-backlog-as-new-api-tier-debuts/)
- [Developers Get Instant Production Access with Google Ads API's Explorer Tier](https://ppcnewsfeed.com/ppc-news/developers-get-instant-production-access-with-google-ads-apis-explorer-tier/)
- [Client Libraries | Google Ads API](https://developers.google.com/google-ads/api/docs/client-libs)
- [GitHub - googleads/google-ads-python](https://github.com/googleads/google-ads-python)
- [The REST interface overview | Google Ads API](https://developers.google.com/google-ads/api/rest/overview)
- [Announcing v23 of the Google Ads API](https://ads-developers.googleblog.com/2026/01/announcing-v23-of-google-ads-api.html)
