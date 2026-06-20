# BACKFINDR — Documento Mestre
> Arquivo único de referência. Toda sessão de desenvolvimento deve começar lendo este arquivo.
> Localização canônica: `~/Downloads/backfindr-local/backfindr-main/BACKFINDR.md`
> Última atualização: 2026-06-20

---

## 1. O QUE É O BACKFINDR

Plataforma SaaS brasileira de recuperação ativa de objetos perdidos. Combina QR Codes permanentes, matching por IA e distribuição inteligente de ocorrências para fechar o ciclo completo: perda → encontro → devolução.

Fundador solo: Marcos (Cido Menezes) — São Paulo/Guarulhos.
Repositório: `https://github.com/reencontra-tudo/backfindr` (branch: `main`)
Produção: `https://backfindr.com`

---

## 2. PREMISSAS ESTRATÉGICAS DO NEGÓCIO
> Consultar sempre antes de propor features, planos ou integrações.

### 2.1 Marketplace de Recompensas
Quem perdeu algo de valor tem alta disposição a pagar para divulgar a busca. O Backfindr intermedia essa transação entre quem perdeu e quem encontrou.

### 2.2 Motor de Distribuição (user-funded acquisition)
A divulgação da ocorrência — redes sociais, push, grupos, ads — é financiada pelo próprio usuário. Quanto maior o valor do objeto, maior a disposição de pagar. O usuário não compra mídia, compra **probabilidade de recuperação**.

### 2.3 Intelligence Hub (maior valor a longo prazo)
O banco de dados de ocorrências é um produto B2B:
- Seguradoras → mapa de risco por bairro/região
- Concessionárias → abordam quem teve veículo roubado
- Prefeituras → diagnóstico de áreas críticas
- Empresas de rastreamento → venda preventiva
- Condomínios e shoppings → relatório mensal

### 2.4 QR Code é o DNA do Objeto
Não é feature — é o produto físico de entrada no Backfindr.
Objeto com QR Code = objeto com identidade rastreável.
Status `protected` = prevenção antes da perda.

### 2.5 Modelo de Receita
- (a) Impulsos avulsos — quem perdeu paga para amplificar
- (b) Assinatura preventiva — quem quer proteger antes de perder
- (c) B2B — empresas com múltiplos ativos
- (d) Intelligence Hub — dados estruturados para mercado corporativo

### 2.6 Foco
Cada feature, plano ou integração deve servir a um desses pilares. Nunca propor algo que não se encaixe nessa lógica sem alertar o fundador primeiro.

---

## 3. STACK TECNOLÓGICA

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Estilo | Tailwind CSS |
| Banco de Dados | PostgreSQL via helper `query()` em `@/lib/db` — **NUNCA usar cliente Supabase diretamente** |
| Autenticação | JWT (access + refresh tokens), Google OAuth, Facebook OAuth |
| Pagamentos | Stripe (Checkout + Webhooks) |
| Email | Resend (domínio: `send.backfindr.com.br`) |
| Mapa | Mapbox GL JS |
| Deploy | Vercel (região: `iad1`) |
| Automação | n8n no Railway (`https://n8n-production-b99a.up.railway.app`) |
| Gerenciador de pacotes | **pnpm** (nunca npm) |

---

## 4. REGRAS TÉCNICAS PERMANENTES

### Deploy
- Workflow correto: sempre commitar na `main` → deploy automático via Vercel
- Vercel pode ser atualizado por: (1) GitHub com deploy automático, ou (2) upload de zip direto
- Correções via zip no Vercel NÃO entram no GitHub — risco de regressão
- **NUNCA** afirmar que "não é possível mexer no Vercel sem o GitHub"

### Banco de Dados
- Usar sempre `query()` de `@/lib/db`
- **NUNCA** usar o cliente Supabase diretamente
- Padrão crítico estabelecido e não negociável

### Pacotes
- Sempre `pnpm install`, nunca `npm install`
- Build: `pnpm run build`

### Arquivos
- Nunca perguntar ao Marcos onde está um arquivo
- Sempre dar o comando de terminal para ele colar o resultado
- Padrão: `find`, `cat`, `ls` → Marcos cola → Claude trabalha

### IA
- Modelo de geração de conteúdo: `gpt-4.1-mini` (não `gpt-4o-mini`)

---

## 5. DOMÍNIOS CONFIGURADOS

| Domínio | Status |
|---------|--------|
| `backfindr.com` / `www.backfindr.com` | ✅ Principal |
| `backfindr.app` / `www.backfindr.app` | ✅ Valid |
| `backfindr.online` / `www.backfindr.online` | ✅ Valid |
| `backfindr.com.br` / `www.backfindr.com.br` | ✅ Valid |

---

## 6. MODELO DE RECEITA ATUAL (em revisão)

> ⚠️ Esta seção está sendo reestruturada. Os planos abaixo são o ponto de partida, não o estado final.

### Impulsos (avulso, qualquer usuário)
| Plano | Preço | Duração |
|-------|-------|---------|
| Impulso | R$ 9,90 | 24h |
| Impulso Plus | R$ 29,90 | 7 dias |
| Impulso Max | R$ 69,90 | 30 dias |

O que entrega: destaque no mapa + push para usuários próximos + (futuro) post automático nas redes do Backfindr.

### Assinatura Preventiva (a definir)
Proposta de valor: proteger objetos antes de perder, não depois.
Preço e features em revisão — não usar os planos antigos (Free/Pro/Business) como referência sem validar primeiro.

### B2B
Condomínios, hotéis, empresas, frotas — precificação sob consulta.

### QR Code Físico (produto independente)
| Produto | Preço |
|---------|-------|
| Digital (PDF para imprimir) | Grátis |
| Adesivo resistente — kit 3 | R$ 19,90 |
| Tag metálica premium | R$ 34,90 |
| Placa veículo/moto | R$ 49,90 |

---

## 7. ESTRUTURA DE ROTAS PRINCIPAIS

### Páginas Públicas
- `/` — Landing page
- `/map` — Mapa público
- `/pricing` — Planos
- `/objeto/[code]` — Página pública do objeto (SSR + SEO)
- `/scan/[code]` — Scan de QR Code
- `/achados-perdidos/` — SEO municipal
- `/achados-perdidos/[cidade]/` — SEO por cidade
- `/achados-perdidos/[cidade]/[categoria]/` — SEO por cidade+categoria

### Dashboard
- `/dashboard` — Painel principal
- `/dashboard/objects` — Lista de objetos
- `/dashboard/objects/new` — Novo objeto
- `/dashboard/matches` — Matches da IA
- `/dashboard/chat/[matchId]` — Chat mediado
- `/dashboard/billing` — Plano e pagamento

---

## 8. SEO LOCAL — STATUS

### Publicadas
- São Paulo (capital) — 18 páginas
- Guarulhos — 34 páginas
- Rio de Janeiro — 17 páginas
- 18 municípios da Grande SP — 126 páginas (commit `b3139ea`)
- Total: ~308 páginas publicadas

### Query de municípios (página /achados-perdidos)
```sql
-- Capitais
SELECT name, slug, state_code FROM municipalities WHERE is_capital = true ORDER BY population DESC

-- Grande SP
SELECT name, slug, state_code FROM municipalities WHERE is_capital = false AND state_code = 'SP' ORDER BY name ASC
```

### Pendentes — Capitais
Salvador (15), Fortaleza (9), Belo Horizonte (16), Curitiba (20), Recife (12), Porto Alegre (22), Brasília (26)

### Padrão obrigatório de conteúdo SEO
1. Intro com contexto local real — bairros, pontos de referência, transporte
2. Dados reais verificados — telefones, endereços, sites oficiais
3. Seções H3 específicas por ponto local
4. Cada seção termina com CTA do Backfindr
5. Títulos NUNCA genéricos
6. FAQ com 3 perguntas locais reais
7. Categoria veículo = ROUBO/FURTO, nunca "perdido"
8. Conteúdo único por cidade

---

## 9. AUTOMAÇÃO — n8n NO RAILWAY

- URL: `https://n8n-production-b99a.up.railway.app`
- Imagem: `n8nio/n8n`
- Config: `PORT=5678`, `N8N_USER_FOLDER=/tmp/n8n`
- ⚠️ Sem volume persistente — dados perdidos no restart (P1 crítico)
- Workflow ativo: "Backfindr AutoPost — Facebook"
- Regras de nicho: veículo/bicicleta = sempre roubado/furtado | celular = aleatório | pet/geral = perdido

---

## 10. PRIORIDADES ABERTAS

| ID | Prioridade | Descrição |
|----|-----------|-----------|
| P1 | 🔴 Crítico | n8n Railway — adicionar volume persistente (dados perdidos no restart) |
| P2 | 🟡 Alto | Verificar deploy do loop WhatsApp (commit `3729529`) |
| P3 | 🟡 Alto | Validar câmera portaria BarcodeDetector em produção |
| P4 | 🟡 Alto | Reestruturação dos planos de receita (em andamento) |
| P5 | 🟠 Médio | 6 índices de performance no Supabase SQL Editor |
| P6 | 🟠 Médio | POST /objects não chama matching/run automaticamente |
| P7 | 🟠 Médio | Navegação de retorno nas páginas SEO local |
| P8 | 🟠 Médio | SEO capitais pendentes (Salvador, Fortaleza, BH, Curitiba, Recife, POA, Brasília) |
| P9 | 🟠 Médio | GSC — redirecionamentos, canonicals, robots.txt |
| P10 | 🟠 Médio | 2.017 páginas /objeto/[codigo] como SEO |
| P11 | 🟢 Baixo | Enriquecer 126 páginas existentes com eventos anuais locais |
| P12 | 🟢 Baixo | Instagram AutoPost via n8n |

### Índices pendentes (P5) — colar no Supabase SQL Editor
```sql
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_objects_created_at ON objects(created_at);
CREATE INDEX idx_objects_status ON objects(status);
CREATE INDEX idx_objects_user_id ON objects(user_id);
CREATE INDEX idx_matches_created_at ON matches(created_at);
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

## 11. VARIÁVEIS DE AMBIENTE (Vercel)

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `JWT_SECRET` | Chave secreta JWT |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | OAuth Facebook |
| `STRIPE_SECRET_KEY` | Chave secreta Stripe |
| `STRIPE_WEBHOOK_SECRET` | Segredo webhook Stripe |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | ID do preço Pro |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token Mapbox |
| `RESEND_API_KEY` | Chave Resend |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública VAPID push |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID |
| `ADMIN_IDS` | IDs de admins (separados por vírgula) |
| `NEXT_PUBLIC_API_URL` | URL base da API |
| `SERPAPI_KEY` | Chave SerpAPI (250 buscas/mês) |
| `OPENAI_API_KEY` | Chave OpenAI (matching + conteúdo) |

---

## 12. PROTOCOLO DE SESSÃO

### Início de sessão
1. Ler este arquivo completo
2. Verificar prioridades abertas (Seção 10)
3. Perguntar por onde começar — sem exigir reexplicação

### Durante a sessão
- Sempre fazer `cat` do arquivo antes de editar
- Sempre fazer backup antes de modificar arquivos críticos
- Usar pnpm, nunca npm
- Commitar na `main` após cada mudança validada

### Fim de sessão
1. Resumir o que foi feito
2. Atualizar as prioridades abertas neste arquivo
3. Commitar o BACKFINDR.md atualizado junto com as demais mudanças

### Comando para atualizar este arquivo no repositório
```bash
cp ~/Downloads/BACKFINDR.md ~/Downloads/backfindr-local/backfindr-main/BACKFINDR.md
cd ~/Downloads/backfindr-local/backfindr-main
git add BACKFINDR.md
git commit -m "docs: atualizar BACKFINDR.md"
git push origin main
```
