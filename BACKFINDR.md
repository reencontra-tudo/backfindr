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
- **Public Signals:** publicação em `objects` é SEMPRE por aprovação manual (`/admin/public-signals`) — pipeline nunca publica sozinho. Qualquer auto-aprovação futura precisa nascer atrás de um toggle explícito, desligado por padrão, desenhado junto com a lógica de automação (não construído antes dela — ver seção 17 e histórico 18-19/08)

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
estabelecimentos, entregadores, analytics_snapshots, boosts, payment_settings, seo_content_seeds, community_posts, public_signal_evidence

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

**Tabela public_signal_evidence** (criada 18/08/2026 — migrations 006-008, ver seção 17 e histórico 18-19/08):
```sql
id, source_url, source_type (press_rss|institution|google_alert_corroboration),
has_contact_data, contact_snapshot JSONB, extracted_fields JSONB,
dedup_hash (UNIQUE), expires_at, status (pending|approved|rejected), captured_at
```
Evidência bruta da descoberta de ocorrências públicas (Public Signals) — nunca publica em `objects` sozinha, só após aprovação manual em `/admin/public-signals`.

**Coluna `users.is_system_account`** (migration 006, 18/08/2026): identifica a conta-âncora que "possui" objetos publicados pelo Public Signals (`SYSTEM_ACCOUNT_ID` fixo em `src/lib/systemAccount.ts`). Protegida por 3 `CHECK` constraints no banco (não só aplicação): nunca plano pago, nunca role admin, e-mail sempre o reservado `public-signals@system.backfindr.internal`.

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
- Workflow **"Backfindr Public Signals — Ingestão Diária"** (ativado 19/08/2026): Schedule Trigger 1x/dia à meia-noite → `POST /api/v1/admin/public-signals/ingest` (header `x-signals-cron-secret`, secret dedicado, não reaproveita `CRON_SECRET` do matching). Descobre ocorrências públicas (imprensa + institucional), nunca publica sozinho — alimenta fila de revisão manual em `/admin/public-signals`. Detalhes completos: seção 17 e histórico de sessão 18-19/08.
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
- **Public Signals — bug `stripHtml()` em `src/app/api/v1/news/route.ts`**: ordem de operações erra (decodifica entidades HTML depois de tentar remover as tags), então descrições com HTML escapado do Google News passam sem strip. O mesmo padrão foi copiado (e corrigido) em `src/lib/publicSignals/sources.ts` para o pipeline novo — a rota `news/route.ts` original continua com o bug, fora de escopo da rodada. Registrado como task separada (spawn_task).
- **Public Signals — área de notificações mais ampla**: proposta a Marcos em 19/08 (cobrir novo cadastro, objeto encontrado/match, além do alerta de ingestão que já existe) — aguardando confirmação de escopo antes de expandir além do que já está em produção.
- **Public Signals — fonte `google_alert_corroboration`**: estrutura pronta em `src/lib/publicSignals/sources.ts`, array vazio de propósito. Direção definida é alimentar via busca SERP API (Brave Search/SerpAPI) em vez de lista fixa de alertas — ainda não implementado.
- **Public Signals — Seções 4 e 5 do prompt master**: outreach institucional automatizado e triagem de mensagens de terceiros ("Encontrei") — não iniciados, fora do escopo da Fase 1.

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
- **Backfindr Public Signals — Fase 1 MVP em produção (18-19/08/2026)**: pipeline de descoberta de ocorrências públicas (imprensa via Google News RSS + institucional via feed CGN de Cascavel-PR) → extração estruturada via LLM (gpt-4o-mini) → dedup por hash de conteúdo (`UNIQUE` no banco + `ON CONFLICT DO NOTHING`, sem janela de corrida) → fila de revisão manual em `/admin/public-signals` (zero auto-publicação) → aprovação humana cria objeto real em `objects` com `source='public_signal'`, dono é a conta-âncora de sistema. Cron n8n "Backfindr Public Signals — Ingestão Diária" ativo, 1x/dia à meia-noite. Escrita completa na entrada de histórico de sessão 18-19/08, ao final desta seção.
- **Filtro de idade nas notícias do Public Signals (19/08/2026)**: RSS do Google News não tem limite de data — duas notícias reais (dez/2022 e mai/2026) entravam na fila parecendo recentes porque só guardávamos a data de coleta, nunca a de publicação. Corrigido: extrai `pubDate`, descarta itens sem data parseável ou com mais de 7 dias.
- **Fonte institucional CGN adicionada ao Public Signals (19/08/2026)**: feed RSS oficial de achados-e-perdidos de Cascavel-PR (`cgn.inf.br/achados-e-perdidos/feed`), maior confiança que imprensa genérica (`SOURCE_CONFIDENCE.institution = 80` vs `press_rss = 50`).
- **Ambiguidade de geocodificação — bairro "Morumbi" (19/08/2026)**: um objeto real foi publicado com coordenada de São Paulo em vez de Cascavel-PR (a fonte CGN cobre exclusivamente Cascavel, mas o texto só citava o bairro). Coordenada ao vivo corrigida via SQL; código corrigido com `regionHint` na definição da fonte, repassado ao prompt de extração, pra não repetir com outros bairros homônimos.
- **Alerta push pro admin no fim de cada ingestão do Public Signals (19/08/2026)**: reaproveita infraestrutura já existente (tabela `notifications`, VAPID push via `sendPushToUser`) — `admin/layout.tsx` passou a registrar push (não registrava antes disso), e o endpoint de ingest notifica admins globais não-B2B com o resumo da rodada (inseridos/fontes/erros).
- **Dois bugs reais de geocoding achados via relatório de status consolidado (19/08/2026)**: além do Morumbi, um segundo caso — "Coqueiral" (Cascavel-PR) geocodificado como Guarapari-ES, mesmo padrão (bairro homônimo sem contexto de cidade). 3 evidências corrigidas (1 objeto ao vivo + 2 pendentes ainda não aprovadas). Padrão confirmado (2/2 bugs, mesma causa raiz) levou a endurecer `Source.regionHint` de opcional (`regionHint?: string`) para obrigatório (`regionHint: string | null`) — força decisão em tempo de compilação pra toda fonte nova, em vez de descoberta reativa.
- **`LIMIT 5000` do mapa resolvido (19/08/2026)**: repriorizado a pedido do usuário (era o item mais urgente da auditoria original, ainda pendente com fontes já ativas). Investigação mostrou que o mapa já cobre escala via clustering nativo do Mapbox — o risco real era o `LIMIT` cortar objeto silenciosamente, não a renderização. `LIMIT` subido pra 20000 + detecção de estouro (`truncated` no payload) + alerta proativo em `/admin/dashboard` acima de 70% de uso (`map_eligible_objects`/`map_query_limit`).
- **Canal de entrada manual pro Public Signals (19/08/2026)**: `POST /api/v1/admin/public-signals/submit` — admin submete uma URL avulsa (achada via Perplexity, busca manual etc.) sem esperar o cron. Reaproveita `extract.ts`/`dedup.ts` do pipeline automático; peça nova é `src/lib/publicSignals/fetchPage.ts` (busca a página e extrai title/`og:description` via regex, já que não vem de RSS estruturado). Síncrono (1 item por vez), `requireAdmin` (não o `SIGNALS_CRON_SECRET`), URL obrigatória (sem texto solto), dedup em 2 camadas (URL exata + hash de conteúdo) antes de inserir, sempre cai em `status='pending'` — mesma fila manual, sem atalho de publicação. UI: formulário em `/admin/public-signals` com o resultado da extração pra confirmação visual.

---


- Otimização de performance da Home (21/07/2026): iniciada com Lighthouse Mobile em aproximadamente Performance 48, LCP 14,4 s, FCP 3,3 s e TBT 480 ms. Principais ações: redução anterior do logo (~4,2 MB → ~20 KB), simplificação da primeira dobra, remoção de efeitos de renderização pesados, carregamento sob demanda do mapa (`DeferredHomeLiveMap`), refatoração da Home em componentes (`Navbar`, `LiveTicker` e `FadeIn`), adiamento do Microsoft Clarity (`strategy="lazyOnload"`) e do bootstrap do Google Analytics (`strategy="lazyOnload"`). Bundle inicial da Home mantido em ~111 kB. Melhor medição obtida durante a sessão: Performance 87, LCP 2,5 s, FCP 2,5 s, TBT ~330 ms e CLS 0. Conclusão registrada: ganhos adicionais passam a depender principalmente dos scripts analíticos (GA/PostHog); prioridade futura passa a ser SEO, páginas locais, Search Console, conversão da Home, IA de matching e monetização (Boost).

---

## 18. PROTOCOLO DE SESSÃO

### Início obrigatório
```bash
cd ~/Downloads/backfindr-local/backfindr-main
cat BACKFINDR.md
git log --oneline -10
```

### Princípios obrigatórios

- O repositório oficial é `~/Downloads/backfindr-oficial`.
- Antes de qualquer alteração estrutural, consultar o `BACKFINDR.md`.
- Nenhuma alteração pode ser realizada sem avaliar risco de regressão.
- Nunca sobrescrever arquivos existentes sem inspecionar seu conteúdo.
- Alterações devem ser pequenas, verificáveis e preferencialmente isoladas por commit.
- Toda decisão arquitetural aprovada deve ser registrada no `BACKFINDR.md`.

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
| 12/07 | PostHog identify no login/cadastro (analytics.identify + sign_up/login); middleware de captura UTM/referrer first-touch; migration 005 (colunas de origem em users) aplicada em produção |
| 12/07 (cont.) | Seção "Origem dos Cadastros" no /admin/analytics (tabela + breakdown por fonte); regra de senha padronizada (min 8 chars) entre cadastro e reset |
| 21/07 | Fix definitivo do workflow Comunidade (parâmetros SQL via array JS); conector n8n MCP configurado no Claude; AutoPost reduzido para 2x/dia com prompt de imagem variado; landing /comecar criada para tráfego pago |
| 21/07 (cont.) | Landing /comecar refinada: copy alinhada aos vídeos de anúncio, proposta de valor, prova social, área de toque expandida (UX mobile) |
| 21/07 (cont. 2) | Segundo round de polimento na /comecar (contraste, tamanho de fonte, prova social refinada); pendências de A/B test e landings segmentadas registradas para decisão futura por dados |
| 21/07 (cont. 3) | Instalação de Microsoft Clarity (gravação de sessão + heatmap) e Meta Pixel (PageView, ViewContent, Lead, Purchase) em todo o site |
| 21/07 (cont. 4) | Grande otimização da Home: Performance Mobile 48→87, LCP 14,4 s→2,5 s, Home refatorada em componentes, DeferredHomeLiveMap, Clarity e GA em `lazyOnload`; etapa de performance considerada concluída |
| 18-19/08 | Backfindr Public Signals Fase 1 (MVP completo): auditoria somente-leitura, conta-âncora + constraints no banco, pipeline de ingestão (descoberta→extração LLM→dedup→fila), fila de aprovação manual, cron n8n ativado e testado em produção, 3 bugs reais corrigidos (filtro de idade, geocoding regionHint, timeout de ingestão), fonte CGN adicionada, alerta push pro admin |

### Sessão 08/07/2026 — Correção RLS (Security Advisor)

- Advisor reportou 2 erros críticos: `public.seo_content_seeds` e `public.object_events` com RLS desativado (acesso público total via URL do projeto).
- Ativado RLS em ambas: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Confirmado que o backend (`src/lib/db.ts`) usa conexão direta via `pg.Pool` com usuário `postgres.trfklsdbsnmybsknjval` (pooler Supabase) — usuário dono das tabelas, bypassa RLS automaticamente. Escrita em `object_events` via `recordEvent()` (`src/lib/events.ts`) não é afetada.
- Criadas policies de SELECT:
  - `seo_content_seeds_select_public`: leitura pública (`USING (true)`) — conteúdo de SEO sem dono.
  - `object_events_select_own`: usuário só lê eventos de objetos que possui, via join com `public.objects.user_id = auth.uid()`.
- **Pendente para próxima sessão:** confirmar no Security Advisor que os 2 erros somem ("0 errors"), testar páginas de SEO local e Activity Center em produção para garantir que a leitura pública não foi afetada.

### Sessão 18-19/08/2026 — Backfindr Public Signals (Fase 1 MVP)

**Objetivo:** descobrir ocorrências reais de objetos/animais perdidos-achados-roubados em fontes públicas (imprensa, feeds institucionais), extrair dado estruturado via LLM, deduplicar, e — só depois de revisão humana — publicar como objeto real no mapa público. Nunca auto-publicar.

**Sequência seguida:** (1) auditoria somente-leitura do código existente (15 perguntas) antes de qualquer linha de código; (2) implementação da Fase 1 MVP a partir de um desenho consolidado (identidade, provenance, retenção, aprovação, dedup, exclusões explícitas); (3) Marcos pediu para seguir "até estar tudo pronto" — aplicação real do pipeline, teste da fila de aprovação, ativação do cron; (4) dois bugs reais encontrados por Marcos inspecionando o app ao vivo, corrigidos na hora.

**Decisões de arquitetura registradas:**
- **Identidade:** conta-âncora de sistema (`is_system_account`, `SYSTEM_ACCOUNT_ID` fixo em `src/lib/systemAccount.ts`), não um usuário comum — protegida por 3 `CHECK` constraints no banco (nunca plano pago, nunca role admin, e-mail sempre `public-signals@system.backfindr.internal`), não só validação de aplicação.
- **Publicação é sempre manual.** Chegou a ser construído um toggle de auto-aprovação (`public_signals_settings.auto_approve_enabled`) preventivamente — Marcos revisou e pediu reversão: *"Se não tem a estrutura de automatização, o botão talvez não faça sentido, é como deixar uma quebra no processo."* Código todo revertido (`git checkout --` + `rm` das migrations/rotas novas), substituído por regra documentada na seção 17: auto-aprovação futura nasce atrás de toggle explícito desenhado **junto com** a automação, nunca antes dela.
- **Dedup em duas camadas:** grosseiro por `source_url` exata, fino por hash de conteúdo normalizado (título tokenizado + categoria + primeira palavra da localização). `UNIQUE(dedup_hash)` no banco (migration 008) + `ON CONFLICT DO NOTHING` — sem essa constraint havia janela de corrida real (SELECT-then-INSERT não atômico) entre execuções sobrepostas do cron; confirmado zero duplicata histórica antes de aplicar.
- **Retenção de dado sensível:** evidências com contato (telefone/e-mail) expiram em 12 meses (`expires_at`); dado nunca vaza para fora de `contact_text`/`contact_snapshot`.

**Pipeline (`src/lib/publicSignals/`):** `sources.ts` (descoberta — Google News RSS 4 buscas + feed institucional CGN Cascavel-PR) → `extract.ts` (extração via gpt-4o-mini, `fetch` direto sem SDK, mesmo padrão de outras rotas) → `dedup.ts` (hash) → `POST /api/v1/admin/public-signals/ingest` (orquestração, chamado 1x/dia pelo n8n) → `/admin/public-signals` (fila, aprovar/rejeitar) → aprovação geocodifica via Mapbox e insere em `objects` com `source='public_signal'`.

**Bugs reais encontrados e corrigidos nesta janela:**
1. **Timeout do endpoint de ingest** apesar do trabalho ter completado (67 linhas inseridas, resposta HTTP nunca chegou) — processamento sequencial estourava os 60s do plano Hobby. Corrigido com `maxDuration=60` + lotes concorrentes (`CONCURRENCY=8`) + teto `MAX_ITEMS_PER_RUN=40` + embaralhamento Fisher-Yates antes do corte (sem isso os mesmos itens do início da fila sempre venciam o teto, os do fim nunca eram avaliados).
2. **Notícias antigas entrando na fila parecendo recentes** (achado por Marcos: um caso de dez/2022, outro de mai/2026) — `pubDate` do RSS era extraído mas descartado, só a data de coleta era guardada. Corrigido: filtro de 7 dias com fail-safe (sem data parseável, descarta).
3. **Bairro "Morumbi" geocodificado errado** (achado por Marcos: objeto real publicado em São Paulo, era Cascavel-PR — a fonte CGN cobre só Cascavel) — LLM e Mapbox não tinham contexto de cidade. Coordenada ao vivo corrigida via SQL; código corrigido com `regionHint` na fonte, repassado ao prompt de extração.

**Resultado em produção (fim da janela):** cron n8n "Backfindr Public Signals — Ingestão Diária" ativo e testado (1x/dia, meia-noite), fonte CGN ligada, filtro de idade ativo, alerta push pro admin no fim de cada rodada (reaproveitando `notifications`+VAPID já existentes — `admin/layout.tsx` passou a registrar push, não registrava antes).

**Pendências que ficaram em aberto** (ver seção 17 para lista viva): bug `stripHtml()` em `news/route.ts` (não confundir com o mesmo bug já corrigido em `publicSignals/sources.ts`), fonte `google_alert_corroboration` (estrutura pronta, SERP API não implementada), área de notificações mais ampla (proposta, aguardando confirmação de escopo), Seções 4-5 do prompt master (outreach institucional, triagem "Encontrei") não iniciadas.

**Adendo (19/08/2026, mesmo dia — relatório consolidado revelou mais 2 bugs reais):** o usuário pediu um relatório de status completo do Public Signals pra outra conversa de acompanhamento. Ao verificar ao vivo (Supabase), apareceu um segundo bug de geocoding idêntico ao Morumbi — "Coqueiral" (Cascavel-PR) publicado como Guarapari-ES. Corrigido (1 objeto ao vivo + 2 evidências pendentes). Padrão de 2/2 bugs por ambiguidade de bairro levou a tornar `regionHint` obrigatório em vez de opcional. No mesmo relatório, o usuário repriorizou o `LIMIT 5000` do mapa (estava pendente desde a auditoria original) — resolvido no mesmo dia, ver seção 17.
