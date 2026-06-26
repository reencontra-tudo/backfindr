# BACKFINDR — Documento Mestre
> Arquivo único de referência. Toda sessão de desenvolvimento deve começar lendo este arquivo.
> Localização canônica: `~/Downloads/backfindr-local/backfindr-main/BACKFINDR.md`
> Última atualização: 2026-06-22 (sessão noite)

---

## 1. O QUE É O BACKFINDR

Plataforma SaaS brasileira composta por **4 produtos independentes** que compartilham a mesma base de usuários, banco de dados e infraestrutura. Cada produto pode ser usado de forma autônoma ou em conjunto.

Fundador solo: Marcos (Cido Menezes) — São Paulo/Guarulhos
Repositório: `https://github.com/reencontra-tudo/backfindr` (branch: `main`)
Produção: `https://backfindr.com`
Projeto anterior: Webjetos (2015) — base de usuários existente, migração planejada

---

## 2. OS 4 PRODUTOS

### P1 — Backfindr Core
Plataforma pública de achados, perdidos e roubados.
- Usuários cadastram objetos (lost/found/stolen/returned)
- IA faz matching entre objetos perdidos e encontrados
- QR codes físicos colados nos objetos — DNA do objeto
- Chat entre usuário e achador após match confirmado
- Notificações push, e-mail, WhatsApp
- **Status funcional:** cadastro, matching manual, QR code, chat, notificações
- **Incompletos:** Social Posts automático, Moderação, BarcodeDetector portaria (feature pendente — nunca implementada)
- **Funcional confirmado:** Tela de sucesso com loop WhatsApp ✅, matching automático ✅, boost conectado ao checkout ✅

### P2 — Backfindr B2B
Empresas com área própria dentro da plataforma.
- Role: `b2b_admin` com `b2b_partner_id` no banco
- Portal do parceiro: `/parceiro/*` (dashboard, objetos, QRcodes, equipe, relatórios)
- **Ciclo incompleto:** onboarding do parceiro não existe (cadastro manual no banco hoje)
- **Monetização pendente:** mensalidade + limite de objetos

### P3 — Backfindr Condomínios
Portaria PWA + moradores + encomendas + custódia + achados internos.
- PWA da portaria: `/portaria/[condominioId]` — completo e funcional
- Página de entrada do morador: `/condominio/[slug]` — completa
- Branding customizável por condomínio
- Notificações de encomenda via WhatsApp e push
- **Ciclo incompleto:** morador cai no `/dashboard` genérico após cadastro
- **Faltando:** histórico de encomendas do morador, achados internos, relatório para síndico
- **Monetização pendente:** mensalidade por nº de unidades

### P4 — Backfindr Delivery
Entregas rastreadas com QR code — produto independente.
- Backend pronto: `entregas`, `estabelecimentos`, `entregadores`
- Página pública de rastreio: `/delivery/[token]` — funcional
- **Ciclo completamente ausente na UI:** criar entrega, interface do entregador, dashboard
- **Monetização pendente:** X entregas/mês grátis, pago acima

---

## 3. PREMISSAS ESTRATÉGICAS DO NEGÓCIO
> Consultar SEMPRE antes de propor features, planos ou integrações.

### 3.1 Marketplace de Recompensas
Quem perdeu algo de valor tem alta disposição a pagar para divulgar a busca. O Backfindr intermedia essa transação entre quem perdeu e quem encontrou.

### 3.2 Motor de Distribuição (user-funded acquisition)
A divulgação da ocorrência — redes sociais, push, grupos, ads — é financiada pelo próprio usuário. O usuário não compra mídia, compra **probabilidade de recuperação**.

### 3.3 Intelligence Hub (maior valor a longo prazo)
O banco de dados de ocorrências é um produto B2B:
- Seguradoras → mapa de risco por bairro/região
- Concessionárias → abordam quem teve veículo roubado
- Prefeituras → diagnóstico de áreas críticas
- Empresas de rastreamento → venda preventiva
- Condomínios e shoppings → relatório mensal

### 3.4 QR Code é o DNA do Objeto
Não é feature — é o produto físico de entrada no Backfindr.
Objeto com QR Code = objeto com identidade rastreável.
Status `protected` = prevenção antes da perda.

### 3.5 Modelo de Receita (estrutura aprovada 21/06/2026)
Seis linhas de receita independentes:
- (a) Impulsos avulsos — quem perdeu paga para amplificar
- (b) Assinatura preventiva — quem quer proteger antes de perder
- (c) Backfindr Auto — produto dedicado a veículos (58% da base)
- (d) Backfindr Pet — produto dedicado a animais (35% da base)
- (e) QR Code físico — produto físico de entrada (adesivo, tag, placa, coleira)
- (f) B2B + Intelligence Hub — empresas, condomínios, seguradoras

### 3.6 Foco
Cada feature, plano ou integração deve servir a um desses pilares. Nunca propor algo fora dessa lógica sem alertar o fundador primeiro.

---

## 4. STACK TECNOLÓGICA

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Banco de Dados | PostgreSQL via helper `query()` em `@/lib/db` — **NUNCA usar cliente Supabase diretamente** |
| Autenticação | JWT + cookies (`access_token`), Google OAuth, Facebook OAuth |
| Pagamentos | MercadoPago + Stripe (ambos integrados) |
| Email | Resend (domínio: `send.backfindr.com.br`) |
| Mapa | Mapbox GL JS |
| Storage | Cloudflare R2 |
| Analytics | PostHog, GA4 |
| Deploy | Vercel (região: `iad1`) |
| Automação | n8n no Railway (`https://n8n-production-b99a.up.railway.app`) |
| Gerenciador de pacotes | **pnpm** — nunca npm |
| IA conteúdo | `gpt-4o-mini` (texto) + `gpt-image-1` (imagem) |

---

## 5. REGRAS TÉCNICAS PERMANENTES

### Deploy
- Workflow correto: commitar na `main` → deploy automático via Vercel
- Vercel pode ser atualizado por: (1) GitHub automático, ou (2) upload de zip direto
- Correções via zip NO Vercel NÃO entram no GitHub — risco de regressão
- **NUNCA** afirmar que "não é possível mexer no Vercel sem o GitHub"

### Banco de Dados
- Usar sempre `query()` de `@/lib/db`
- **NUNCA** usar o cliente Supabase diretamente
- DATABASE_URL de produção: obter via `npx vercel env pull .env.vercel.local --yes`

### Pacotes
- Sempre `pnpm install` e `pnpm run build` — nunca npm

### Arquivos
- Nunca perguntar ao Marcos onde está um arquivo
- Sempre dar o comando de terminal para ele colar o resultado
- Padrão: `find`, `cat`, `ls` → Marcos cola → Claude trabalha

---

## 6. AMBIENTE LOCAL

```bash
# Subir banco
bash ~/Downloads/iniciar-backfindr.sh

# Rodar projetos (duas abas)
cd ~/Downloads/rastrear-integrado && pnpm dev        # porta 3002
cd ~/Downloads/backfindr-local/backfindr-main && pnpm dev  # porta 3003

# Admin local
localhost:3003/admin/dashboard
admin@backfindr.com / admin123
```

---

## 7. DOMÍNIOS

| Domínio | Status |
|---------|--------|
| `backfindr.com` / `www.backfindr.com` | ✅ Principal |
| `backfindr.app` / `www.backfindr.app` | ✅ Valid |
| `backfindr.online` / `www.backfindr.online` | ✅ Valid |
| `backfindr.com.br` / `www.backfindr.com.br` | ✅ Valid |

---

## 8. BANCO DE DADOS — TABELAS PRINCIPAIS

```
users            — base compartilhada de todos os produtos
objects          — P1: objetos perdidos/achados/roubados
matches          — P1: matches por IA entre objetos
municipalities   — SEO: municípios brasileiros
local_pages      — SEO: páginas por município+categoria
condominios      — P3: condomínios cadastrados
porteiros        — P3: porteiros vinculados
unidades         — P3: unidades/apartamentos e moradores
encomendas       — P3: encomendas na portaria
custodias        — P3: itens em custódia
b2b_partners     — P2: empresas parceiras
entregas         — P4: entregas rastreadas
estabelecimentos — P4: remetentes/estabelecimentos
entregadores     — P4: entregadores cadastrados
analytics_snapshots — snapshots diários às 7h
boosts           — impulsos pagos por objeto
payment_settings — configurações de pagamento
```

### Dados reais de produção (auditado 21/06/2026)
- 4.303 usuários (99,95% free, 2 pro)
- 2.019 objetos: 58% veículos, 35% animais
- 1 boost vendido, 1 condomínio, 0 parceiros B2B
- 434 páginas SEO publicadas (62 municípios × 7 categorias)

### Roles de usuário
```
user        — usuário comum (P1)
super_admin — superadmin da plataforma
admin       — colaborador interno
b2b_admin   — admin de parceiro B2B (P2)
porteiro    — porteiro de condomínio (P3) via tabela porteiros
```

---

## 9. MODELO DE RECEITA (estrutura definida 21/06/2026)

### Linha 1 — Impulsos avulsos (qualquer usuário, sem assinatura)
| Plano | Preço | Duração | O que entrega |
|-------|-------|---------|---------------|
| Impulso Básico | R$ 9,90 | 24h | Destaque no mapa + push 5km |
| Impulso Plus | R$ 29,90 | 7 dias | + post redes Backfindr + push diário |
| Alerta Máximo | R$ 69,90 | 30 dias | + raio 50km + relatório semanal |

**Oferta deve aparecer imediatamente após cadastro de objeto lost/stolen — não na página de detalhes.**

### Linha 2 — Assinatura Proteção
| Plano | Preço | O que entrega |
|-------|-------|---------------|
| Gratuito | R$ 0 | 1 objeto, QR digital, mapa, matching básico |
| Proteção | R$ 14,90/mês | 10 objetos, QR ativo, alerta escaneamento, IA prioritária, 1 impulso/mês |

### Linha 3 — Backfindr Auto (novo produto — veículos)
| Produto | Preço | Modelo |
|---------|-------|--------|
| Alerta Veicular | R$ 49,90 | Avulso |
| Monitoramento Ativo | R$ 19,90/mês | Recorrente |
| Pacote Seguradora | B2B | Dado estruturado vendido para seguradoras |

### Linha 4 — Backfindr Pet (novo produto — animais)
| Produto | Preço | Modelo |
|---------|-------|--------|
| Proteção Pet | R$ 19,90/mês | Perfil animal + alerta avistamento + rede tutores |
| Coleira QR | R$ 29,90 | Produto físico — ativa Proteção Pet grátis por 30 dias |

### Linha 5 — QR Code físico
| Produto | Preço |
|---------|-------|
| Digital (PDF) | Grátis |
| Adesivo kit 3 | R$ 19,90 |
| Tag metálica | R$ 34,90 |
| Placa veículo | R$ 49,90 |
| Coleira pet | R$ 29,90 |

### Linha 6 — B2B e Intelligence Hub
| Produto | Preço |
|---------|-------|
| P2 Empresas | R$ 599–2.999/mês |
| P3 Condomínios | R$ 2–5/unidade/mês |
| Intelligence Hub | R$ 2k–15k (relatório) / R$ 3k/mês (API) |

---

## 10. SEO LOCAL — STATUS (auditado 21/06/2026)

### Publicadas — dados reais do banco de produção
- **Total: 434 páginas publicadas** (62 municípios × 7 categorias)

### Municípios com páginas publicadas (62 no total)
**Capitais:** São Paulo SP, Rio de Janeiro RJ, Belo Horizonte MG, Salvador BA, Fortaleza CE, Curitiba PR, Recife PE, Porto Alegre RS, Brasília DF, Manaus AM, Belém PA, Goiânia GO, São Luís MA, Maceió AL, Natal RN, Teresina PI, Campo Grande MS, João Pessoa PB, Aracaju SE, Cuiabá MT, Macapá AP, Boa Vista RR, Palmas TO, Vitória ES, Florianópolis SC, Rio Branco AC

**Grande SP:** Guarulhos, Santo André, Osasco, São Bernardo do Campo, São Caetano do Sul, Diadema, Mauá, Ribeirão Pires, Rio Grande da Serra, Mogi das Cruzes, Suzano, Itaquaquecetuba, Poá, Ferraz de Vasconcelos, Guararema, Arujá, Biritiba Mirim, Salesópolis, Barueri, Carapicuíba, Cotia, Embu das Artes, Embu-Guaçu, Itapecerica da Serra, Itapevi, Jandira, Juquitiba, Mairiporã, Santana de Parnaíba, São Lourenço da Serra, Taboão da Serra, Vargem Grande Paulista, Caieiras, Cajamar, Francisco Morato, Franco da Rocha

### Padrão obrigatório de conteúdo SEO
1. Intro com contexto local real — bairros, pontos de referência, transporte
2. Dados reais verificados — telefones, endereços, sites oficiais
3. Seções H3 específicas por ponto local
4. CTA do Backfindr ao final de cada seção
5. Títulos NUNCA genéricos
6. FAQ com 3 perguntas locais reais
7. Categoria veículo = ROUBO/FURTO, nunca "perdido"
8. Conteúdo único por cidade — nunca copiar trocando só o nome

---

## 11. AUTOMAÇÃO — n8n NO RAILWAY

### Configuração atual
- URL: `https://n8n-production-b99a.up.railway.app`
- Admin: `admin@backfindr.com`
- Workflow ID: `urluPuyxe4ccY9ZE`
- Cron: 4 posts/dia (a cada 6h)

### Workflow ativo: "Backfindr AutoPost — Facebook"

#### Nichos configurados
```javascript
const niches = ['pet','celular','veiculo','bicicleta','geral','geral','protect'];
const niche = niches[Math.floor(Math.random() * niches.length)];
return [{ json: { niche, city: 'São Paulo' } }];
```

#### Prompt do "Gerar post OpenAI" (atualizado 22/06/2026)
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "Você é um morador real de {{ $json.city }} desabafando no Facebook. Siga rigorosamente as regras: 1) SITUAÇÃO: nicho 'veiculo' e 'bicicleta'→SEMPRE roubado/furtado, NUNCA perdido; 'celular'→perdido OU roubado (varie aleatoriamente); 'pet'→SEMPRE perdido; 'geral'→SEMPRE perdido ou roubado (varie); 'protect'→dono preocupado que AINDA NÃO perdeu nada mas viu casos de furto/roubo ao redor e decidiu proteger seus objetos com QR code preventivo. 2) ESTILO: 3-4 linhas, tom informal e urgente, pessoa real, NUNCA pareça propaganda, termine com CTA natural e o link https://backfindr.com. 3) IMAGEM: descricao_visual deve ser cena urbana brasileira emocional e realista — para 'protect': pessoa colando QR code no objeto, família organizando documentos/chaves, pessoa aliviada vendo notificação de objeto escaneado. Sem texto na imagem. Responda APENAS com JSON: {texto_post, descricao_visual}."
    },
    {
      "role": "user",
      "content": "Crie um post para o nicho '{{ $json.niche }}' em {{ $json.city }}. Escolha aleatoriamente um objeto específico dentro do nicho: 'veiculo'→carro, moto ou caminhão (contexto urbano, sem máquinas agrícolas); 'pet'→cachorro, gato, pássaro ou outro animal de estimação; 'bicicleta'→bike comum ou elétrica; 'celular'→smartphone (perdido em transporte público/rua ou roubado na rua/festa); 'geral'→qualquer objeto cotidiano como carteira, mochila, chave, óculos, documento, ou carga roubada (mercadoria, encomenda, carga em trânsito); 'protect'→objeto de valor que o dono decidiu proteger preventivamente (celular, mochila, bike, chave do carro)."
    }
  ],
  "response_format": { "type": "json_object" }
}
```

#### Fluxo completo do workflow
```
Cron 4h → Escolher nicho → Gerar post OpenAI → Extrair texto → HTTP Request (gpt-image-1)
→ Code in JavaScript (base64 + fileName + ig_image_url)
→ Upload a file (R2)
→ If (nicho ≠ protect)
    → true: HTTP Request4 (IG Create) → Wait 5s → HTTP Request5 (IG Publish)
    → false: [pula Instagram]
→ HTTP Request2 (Facebook OpenAI caption)
→ Code in JavaScript1
→ HTTP Request1 (Facebook post — todos os nichos)
→ HTTP Request3 [Deactivated — token antigo]
```

### Páginas do Facebook configuradas
| Página | ID | Nicho |
|--------|----|-------|
| Backfindr localizar animais perdidos | `1058341297366140` | pet |
| Celular Roubado Perdido | `472039546624261` | celular |
| Bicicleta Roubada Furtada | `301459970061606` | bicicleta |
| Carro Roubado Furtado | `607774492681517` | veículo |
| Webjetos Roubados e Perdidos | `229182413876628` | geral + protect |

- App ID Meta: `1286158296941920`
- App Secret: `87a517f442f39bb513a03f7cf05be098`

### Instagram @backfindroficial — FUNCIONANDO ✅
- Instagram Business Account ID: `17841416288148947`
- Handle: `@backfindroficial`
- Vinculado à página Webjetos (`229182413876628`)
- **Nichos publicados:** pet, celular, bicicleta, veículo, geral (5 nichos)
- **Nicho excluído:** `protect` (filtrado pelo nó If)
- **Token (user token, expira ~30/07/2026):**
  `EAASRwRBqBWABRzAICB11OKio2kBUzagVPQjZBloiNOZB9THfn7v0Eg5R3t94DQ5zPYJzE3sQUF8TcDuRfNZBbEtjrFtOX317bPynRJ5yZAF3oYFjHUBv0vZCZBPFt71jIzLBmK1kZB8VwiaXF5NM3GRwcDlRO0vZAYpKOk0N20puFG5ldzzmkT3wrZALit688`

### Cloudflare R2
- Bucket: `backfindr-media`
- Public URL: `https://pub-a83994ac58034799aad260beb4d55fa3.r2.dev`
- Account ID: `14823c21203d8830e4bed1efcb94c91c`
- Credencial S3 no n8n: "S3 account" — endpoint R2, region `auto`, Force Path Style ativado
- Imagens salvas em: `autopost/{timestamp}.jpg`

### Renovação de tokens (~30/07/2026)
```bash
# 1. Trocar token curto por longo
curl "https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=1286158296941920&client_secret=87a517f442f39bb513a03f7cf05be098&fb_exchange_token=TOKEN_CURTO"

# 2. Pegar page tokens
curl "https://graph.facebook.com/v20.0/me/accounts?access_token=TOKEN_LONGO"
```

### Erros conhecidos
- `moderation_blocked` no `gpt-image-1`: ocorre ~5% das execuções com cenas de crime. Não crítico — execução seguinte funciona normalmente. Pendente: adicionar tratamento de erro para continuar sem travar.

---

## 12. PRIORIDADES ABERTAS (atualizado 22/06/2026)

| ID | Prioridade | Descrição |
|----|-----------|-----------|
| P1 | 🟡 Alto | n8n — tratamento de erro `moderation_blocked` (continuar sem travar) |
| P2 | 🟡 Alto | n8n — Páginas antigas Facebook (identificar IDs, adicionar ao workflow) |
| P3 | 🟡 Alto | Implementar estrutura de monetização no código (ver Seção 9) |
| P4 | 🟠 Médio | n8n Content Engine — tabela `post_queue` + fila de aprovação no admin |
| P5 | 🟠 Médio | BarcodeDetector portaria — feature pendente (nunca implementada) |
| P6 | 🟠 Médio | Enriquecer 434 páginas SEO com eventos anuais e mais qualidade |
| P7 | 🟠 Médio | GSC — redirecionamentos, canonicals, robots.txt |
| P8 | 🟠 Médio | Páginas /objeto/[codigo] como SEO (2.019 objetos) |
| P9 | 🟢 Baixo | P2 B2B — onboarding do parceiro, plano e cobrança |
| P10 | 🟢 Baixo | P3 Condomínios — histórico encomendas, achados internos, relatório síndico |
| P11 | 🟢 Baixo | P4 Delivery — dashboard remetente, interface entregador |

### Resolvidos (22/06/2026)
- ✅ **Fase 2 Motor de Distribuição** — Instagram @backfindroficial publicando automaticamente
- ✅ Cloudflare R2 configurado (base64 → URL pública)
- ✅ Filtro nicho `protect` no Instagram (nó If — false vai para Facebook, true vai para Instagram)
- ✅ Prompt `protect` corrigido — conteúdo de prevenção/QR code preventivo
- ✅ Nicho `geral` agora inclui carga roubada
- ✅ Token de longa duração gerado (expira ~30/07/2026)

### Resolvidos (21/06/2026)
- ✅ Tela de sucesso WhatsApp já funcional
- ✅ BarcodeDetector reclassificado: feature nova, não bug
- ✅ Matching automático já implementado no POST /objects
- ✅ 6 índices de performance executados no Supabase
- ✅ Boost conectado ao checkout MercadoPago já implementado

---

## 13. VARIÁVEIS DE AMBIENTE (Vercel)

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | String de conexão PostgreSQL (obter via `npx vercel env pull`) |
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
| `NEXT_PUBLIC_APP_URL` | `https://backfindr.com` (sem www) |
| `SERPAPI_KEY` | Chave SerpAPI (250 buscas/mês) |
| `OPENAI_API_KEY` | Chave OpenAI (matching + conteúdo) |
| `MP_ACCESS_TOKEN` | Access token MercadoPago (env Vercel) |

---

## 14. PROTOCOLO DE SESSÃO

### Início
1. Ler este arquivo completo: `cat ~/Downloads/backfindr-local/backfindr-main/BACKFINDR.md`
2. Verificar prioridades abertas (Seção 12)
3. Perguntar por onde começar — sem exigir reexplicação do Marcos

### Durante
- Sempre `cat` do arquivo antes de editar
- Sempre backup antes de modificar arquivos críticos
- Usar pnpm, nunca npm
- Commitar na `main` após cada mudança validada
- NUNCA declarar algo como "feito" sem verificar no código primeiro

### Fim
1. Resumir o que foi feito
2. Atualizar prioridades abertas neste arquivo (Seção 12)
3. Atualizar data no cabeçalho
4. Gerar arquivo com nome BACKFINDR-YYYY-MM-DD-vN.md
5. Marcos baixa, copia e commita

### Instalar/atualizar este arquivo no repositório
```bash
cp ~/Downloads/BACKFINDR-YYYY-MM-DD-vN.md ~/Downloads/backfindr-local/backfindr-main/BACKFINDR.md
cd ~/Downloads/backfindr-local/backfindr-main
git add BACKFINDR.md
git commit -m "docs: atualizar BACKFINDR.md"
git push origin main
```

---

## SESSÃO 23/06/2026 — SEO Content Engine + Google Business

### SEO Content Engine (n8n + Supabase)
- Tabela `seo_content_seeds` criada com 46 seeds em 5 clusters: achei_objeto (10), perdi_objeto (10), qr_protecao (10), pets (8), b2b (8)
- Workflow n8n "Backfindr SEO Content — Daily Post" publicado e ativo — cron diário às 9h
- Pipeline: Cron 9h → Buscar seed (Supabase) → Gerar post (OpenAI gpt-4o-mini) → Processar post (Code JS) → Inserir em community_posts → Marcar seed como usado
- Credenciais n8n: Bearer Auth account (OpenAI), Postgres account (Supabase pooler aws-1-us-east-1, porta 6543)
- `category` sempre minúsculo — `.toLowerCase()` aplicado no node Processar post
- 2 posts já em produção em backfindr.com/comunidade
- Seeds se esgotam em ~46 dias — reabastecer antes disso

### Google Business Profile
- Perfil "Backfindr" (ex-Webjetos) atualizado: telefone (11) 2358-9416, site backfindr.com
- Redes sociais cadastradas: YouTube @BackfindrPlataformaGlobal, TikTok @backfindr, Facebook /webjetos, Instagram @backfindroficial
- Data de abertura ainda mostra 2010 (Webjetos) — pendente correção para 2026

### Link Building
- Diretórios priorizados: Google Business ✅, Bing Places ⏳, Capterra ⏳, Product Hunt ⏳, Alternativeto ⏳, Reclame Aqui ⏳
- Descrições padrão geradas: curta (160 chars), média (300 chars), longa (500 chars)

### Pendências adicionadas
- Adicionar mais seeds ao banco seo_content_seeds (esgotam em ~46 dias)
- Corrigir data de abertura no Google Business para 2026
- Cadastrar Backfindr no Bing Places, Capterra, Product Hunt

---

## SESSÃO 23/06/2026 — Diagnóstico geral + decisão de monetização

### Protocolo de sessão
- Caminho canônico do BACKFINDR.md confirmado: ~/Downloads/backfindr-local/backfindr-main/BACKFINDR.md
- Código está em src/ (não em app/ diretamente) — corrigir buscas futuras

### Diagnóstico do código (confirmado hoje)
- Estrutura de monetização existente: pricing/client.tsx, billing/page.tsx, checkout/* — tudo funcional
- Preços atuais desatualizados: Boost R$9,90/24,90/14,90 → precisam virar R$9,90/39,90/89,90
- Planos Pro R$29 / Business R$149 → não refletem o modelo do negócio
- Tela /sucesso já tem loop WhatsApp excelente — NÃO mexer
- Tela /sucesso NÃO oferece boost pós-cadastro — maior oportunidade de conversão

### Decisão tomada
- Próxima sessão dedicada 100% à monetização
- Processo: estratégia → copy → design conceitual → aprovação → código
- Nada de código antes de aprovar estratégia completa

### Google Business
- Problema: jackchicken.com.br aparece no perfil (cadastrado pelo próprio Marcos em outro contexto)
- Edições feitas mas travadas há +1 mês sem aprovação do Google
- Ação: aguardar ou acionar suporte do Google Business

## 12. PRIORIDADES ABERTAS — ATUALIZADO 23/06/2026

PENDENTES:
- P1 ALTO: Monetizacao — sessao dedicada (estrategia + design + copy + codigo)
- P2 MEDIO: n8n Content Engine — fila de aprovacao post_queue + painel admin
- P3 MEDIO: Enriquecer 434 paginas SEO com eventos anuais locais
- P4 MEDIO: GSC — verificar canonicals achados-perdidos e indexacao
- P5 MEDIO: Seeds seo_content_seeds esgotam em 46 dias — reabastecer
- P6 MEDIO: Google Business — data de abertura travada em 2010 ha mais de 1 mes
- P7 BAIXO: BarcodeDetector portaria — feature nunca implementada
- P8 BAIXO: B2B — onboarding do parceiro, plano e cobranca
- P9 BAIXO: Condominios — historico encomendas, achados internos, relatorio sindico
- P10 BAIXO: Delivery — dashboard remetente, interface entregador

RESOLVIDOS E CONFIRMADOS NO CODIGO — NAO REABRIR:
- moderation_blocked n8n: JA RESOLVIDO
- paginas antigas Facebook: contexto errado, nao se aplica
- robots.ts: existe e correto em src/app/robots.ts
- objeto/[code] como SEO: JA IMPLEMENTADO com metadata canonical OpenGraph
- Tela sucesso WhatsApp: JA FUNCIONAL com loop de compartilhamento
- Matching automatico: JA IMPLEMENTADO no POST /objects
- Boost conectado ao checkout MercadoPago: JA IMPLEMENTADO
- 6 indices de performance Supabase: JA EXECUTADOS
- Instagram backfindroficial: FUNCIONANDO 5 nichos protect filtrado
- Cloudflare R2: CONFIGURADO
- Token Meta longa duracao: GERADO expira 30/07/2026
- 434 paginas SEO: PUBLICADAS em producao
- sitemap.ts e achados-perdidos/sitemap.ts: EXISTEM

REGRA PERMANENTE: antes de incluir qualquer item como pendente, verificar no codigo se ja existe. Nunca reabrir itens resolvidos sem evidencia no codigo. Codigo esta em src/ nao em app/ diretamente.

## SESSÃO 23/06/2026 PARTE 2 — Redesign do cartaz

### Cartaz redesenhado (commit 8edc109)
- Novo route.tsx: dark hero, foto ocupa zona superior como fundo com overlay
- Mapa OSM via tiles internos (sem API externa, sem token) — lat/lng do banco
- QR code proporcional (160px) — elemento funcional, nao dominante
- Recompensa em destaque quando disponivel (box amarelo no A4, texto dourado nos outros)
- Badge de status no canto superior direito
- 3 formatos: square (1080x1080), vertical (1080x1920), a4 (2480x3508)
- Query SQL atualizada para incluir latitude e longitude

### Pendente (cartaz)
- Padronizacao de imagens no momento do upload (sharp/resize) — sessao separada
- Validar resultado em producao com objeto real que tenha latitude/longitude

### Decisoes arquiteturais
- Mapa: tiles OSM fetchados como data URL e compostos no JSX do next/og
- Imagens: padronizacao deve acontecer no upload, nao na geracao do cartaz
- QR code: elemento funcional discreto, nao a peca principal

### Fix objectFit (commit b85b58b)
- Removido objectFit cover + objectPosition center do quadrado e vertical
- Quadrado: FUNCIONANDO com dark hero
- A4: FUNCIONANDO
- Vertical: ainda 500 — problema no template novo (nao e objectFit, nao e position:absolute)
- Hipotese: algo no JSX do vertical especifico que next/og nao suporta
- Proxima sessao: isolar elemento por elemento no vertical ate encontrar o culpado

### Decisao arquitetural
- next/og suporta position:absolute normalmente (quadrado prova isso)
- objectFit cover nao era o problema primario
- Investigacao deve comecar removendo o overlay gradiente do vertical (inset:0)

### Cartaz — STATUS FINAL (23/06/2026)
- Vertical ✅ — commit 7147701 (fix: qrSize não definido no escopo)
- Quadrado ✅ — commit b85b58b (fix: objectFit removido)
- A4 ✅ — funcionava desde o início
- Causa raiz do vertical: qrSize usado mas não declarado no bloco substituído
- Mapa OSM: desabilitado (position:absolute causa failed to pipe no next/og)
- Imagem padrão por categoria: pendente sessão dedicada
- Notificações (foto, boost, engajamento): pendente sessão dedicada

## SESSÃO 24/06/2026 — Cartaz e botões

### O que foi feito
- Vertical ✅ funcionando (dark, foto proporcional com maxHeight)
- Quadrado ✅ funcionando (dark hero)
- A4 ✅ funcionando (branco, imprimível — é o melhor para imprimir)
- Botão "Baixar PNG" no dashboard → A4 ✅ funcionando corretamente
- Commits: b85b58b, 7147701, 96a4b31, dec7951, 2377d43

### Pendente — PRÓXIMA SESSÃO
- Botão "Baixar Cartaz" na área pública (/objeto/[code]):
  - Nome errado: deveria ser algo como "Imprimir Cartaz" ou "Baixar Cartaz"
  - Formato errado: deve gerar A4 (igual ao Baixar PNG do dashboard)
  - Lógica: downloadPoster('a4') — o vertical dark é para redes sociais, não para cartaz imprimível
- Os botões WhatsApp/Facebook/Instagram Stories já existem na área pública para compartilhar
- O vertical dark pode ser usado futuramente para compartilhar nas redes com um botão específico
- Imagem padrão por categoria quando sem foto — pendente sessão dedicada
- Notificações (foto, boost, engajamento) — pendente sessão dedicada
- Mapa OSM no cartaz — pendente sessão dedicada (position:absolute não funciona no next/og)

## SESSÃO 24/06/2026 — Cartaz e botões

### O que foi feito
- Vertical ✅ funcionando (dark, foto proporcional com maxHeight)
- Quadrado ✅ funcionando (dark hero)
- A4 ✅ funcionando (branco, imprimível — é o melhor para imprimir)
- Botão "Baixar PNG" no dashboard → A4 ✅ funcionando corretamente
- Commits: b85b58b, 7147701, 96a4b31, dec7951, 2377d43

### Pendente — PRÓXIMA SESSÃO
- Botão "Baixar Cartaz" na área pública (/objeto/[code]):
  - Nome errado: deveria ser algo como "Imprimir Cartaz" ou "Baixar Cartaz"
  - Formato errado: deve gerar A4 (igual ao Baixar PNG do dashboard)
  - Lógica: downloadPoster('a4') — o vertical dark é para redes sociais, não para cartaz imprimível
- Os botões WhatsApp/Facebook/Instagram Stories já existem na área pública para compartilhar
- O vertical dark pode ser usado futuramente para compartilhar nas redes com um botão específico
- Imagem padrão por categoria quando sem foto — pendente sessão dedicada
- Notificações (foto, boost, engajamento) — pendente sessão dedicada
- Mapa OSM no cartaz — pendente sessão dedicada (position:absolute não funciona no next/og)

## SESSÃO 25/06/2026 — Cartaz quadrado + botões área pública

### O que foi feito
- Botão "Baixar Cartaz" área pública → formato A4 ✅ (ce6f02f)
- Cartaz quadrado redesenhado do zero ✅
  - Sharp 0.35.2 instalado — resize com fit:'contain', fundo #111827
  - Layout: duas zonas separadas por linha teal (foto 580px / conteúdo 500px)
  - Sem sobreposição de texto, sem distorção, objeto visível inteiro
  - Deploy via npx vercel --prod ✅
- Solução definitiva next/og: usar Sharp ANTES do Satori
  - objectFit, backgroundImage, minWidth/minHeight NÃO funcionam no Satori
  - fit:'contain' com background escuro funciona para qualquer proporção de objeto

### Pendente
- Imagem padrão por categoria quando sem foto
- Notificações (foto, boost, engajamento)
- Monetização — sessão dedicada (prioridade máxima para lançamento)
- Canonicals GSC + seeds SEO esgotam em ~46 dias


---

## Sessao 26/06/2026 - Sistema Vivo: Fundacao Completa

### Contexto estrategico desta sessao

Esta foi a sessao mais importante desde o lancamento do Backfindr em 2026. Nao pelo que foi codificado, mas pelo que foi descoberto e decidido. A mudanca nao foi tecnica - foi filosofica, e vai orientar todas as decisoes de produto daqui para frente.

Descoberta central: O Backfindr ja nao e mais um MVP. Possui centenas de rotas, dezenas de modulos, matching com IA, QR Code, mapa, notificacoes, analytics, comunidade, boost, billing, SEO programatico, condominio, delivery, etc. O problema nao e a falta de features. O problema e que o usuario enxerga talvez 10% do valor que ja existe.

A pergunta que mudou tudo: "Como fazemos o usuario sentir que existe uma maquina inteira trabalhando por ele?"

Essa pergunta redefiniu completamente a direcao do produto.

---

### Decisoes estrategicas permanentes

FILOSOFIA OFICIAL DO PRODUTO:
"O Backfindr existe para aumentar as oportunidades de reencontro."

Esta frase passa a orientar TODAS as decisoes de produto, UX, monetizacao e comunicacao. Ela resolve tres problemas simultaneamente:
1. Promessa honesta: nao prometemos encontrar, prometemos aumentar as chances.
2. Escopo ilimitado: QR Code aumenta oportunidades. Cartaz aumenta. WhatsApp aumenta. IA aumenta. Boost aumenta. Tudo cabe.
3. Posicionamento unico: nenhum concorrente pode copiar isso porque e uma filosofia, nao uma feature.

SISTEMA VIVO VS LOG DE EVENTOS (distincao fundamental e permanente):
Nao vamos construir um log de eventos. Vamos construir um motor de atividade.
- Log passivo: registra o que aconteceu para auditoria.
- Motor de atividade: comunica ao usuario que o sistema continua trabalhando por ele, mesmo quando ele esta dormindo.
Esta distincao deve orientar todas as decisoes de arquitetura, UX e copy.

POSICIONAMENTO EVOLUIDO:
De "plataforma de perdidos e achados" para "sistema vivo de recuperacao patrimonial".
Isso nao e semantica. Muda todas as decisoes futuras de UX, monetizacao e posicionamento.

IDEIA MAIS IMPORTANTE DESTA SESSAO - EXPECTATIVAS FUTURAS:
Nao registrar apenas eventos passados. Registrar expectativas futuras.
Apos matching_completed, o sistema deve comunicar: "Nova comparacao automatica em aproximadamente 14 minutos."
Isso elimina a sensacao de abandono. O usuario nao pensa "acabou" - pensa "o sistema continua trabalhando."
Essa diferenca psicologica e enorme e transforma retencao passiva em engajamento ativo.

MODELO DE UI DEFINITIVO - ESTADO ATUAL + HISTORICO:
A UI nao deve mostrar apenas historico. Deve mostrar:

  Sistema ativo
  - Publicada
  - IA monitorando
  - Visivel no mapa

  Hoje 20:14 - Ocorrencia publicada
  Hoje 20:15 - IA iniciou comparacao
  Hoje 20:15 - 842 objetos comparados
  Hoje 20:17 - Nenhuma correspondencia encontrada

O usuario olha 2 segundos e entende: "Meu objeto continua sendo monitorado." Sem precisar interpretar.

JORNADA PSICOLOGICA DO USUARIO (mapeada):
- Cadastro publicado -> Alivio -> Compartilhar
- IA iniciou comparacao -> Esperanca -> Aguardar
- QR Code escaneado -> Excitacao -> Verificar detalhes
- N pessoas visualizaram -> Confianca -> Permanecer
- Match encontrado -> Urgencia -> Confirmar match
- N dias sem novidade -> Ansiedade -> Ativar boost
- Boost ativado -> Controle -> Persistir
- Objeto recuperado -> Celebracao -> Indicar o Backfindr

SPRINTS REDEFINIDAS POR OBJETIVO MENSURAVEL:
- Sprint A: Usuario sente que o sistema esta trabalhando por ele (CONCLUIDA esta sessao)
- Sprint B: Usuario ve dados reais, nao zeros (proxima sessao)
- Sprint C: Usuario volta amanha (retencao)
- Sprint D: Usuario faz o primeiro pagamento (conversao natural)
Nota: "Pagamento" nao aparece explicitamente na jornada. Acontece naturalmente durante "Maior alcance" quando o usuario ja confia no sistema.

ORDEM DAS PROXIMAS SPRINTS:
Sprint 2 (PROXIMA SESSAO - PRIORIDADE MAXIMA):
  Plugar eventos no /matching/run:
  - matchingStarted (quando a IA inicia)
  - matchingCompleted com count de objetos comparados
  - matchFound para cada match encontrado (0..N)
  - ownerNotified quando o dono e avisado
  Esta sprint completa o "coracao" do Sistema Vivo. Sem ela, a timeline mostra apenas criacao.

Sprint 4 (IMEDIATAMENTE APOS Sprint 2 - PONTO DE INFLEXAO):
  Criar GET /api/v1/objects/[id]/events e conectar ActivityCenterCard para dados reais.
  Este e o momento em que tudo muda. O usuario finalmente ve o sistema trabalhando.
  Query principal:
    SELECT type, title, description, source, metadata, created_at
    FROM object_events WHERE object_id = $1
    ORDER BY created_at DESC LIMIT 20;
  Summary agregado:
    SELECT
      COUNT(*) FILTER (WHERE type = 'qr_scanned') as total_scans,
      COUNT(*) FILTER (WHERE type = 'match_found') as total_matches,
      COUNT(*) FILTER (WHERE type IN ('matching_started','matching_completed')) as total_ai_runs
    FROM object_events WHERE object_id = $1;

Sprint 3 (DEPOIS das sprints 2 e 4):
  Boost comprado, status changed, objeto recuperado.
  Sao eventos eventuais - enriquecem a timeline mas nao sao o coracao.

Sprint 5 (visao futura):
  Timeline visual completa com timestamps reais, estado atual + historico, expectativas futuras.

---

### O que foi construido nesta sessao

SPRINT A - CENTRO DE ATIVIDADE DA OCORRENCIA (CONCLUIDA)

Arquivo criado: src/components/object-detail/ActivityCenterCard.tsx

Componente proprio, desacoplado da pagina, inserido na coluna esquerda de /dashboard/objects/[id] ANTES do grid de conteudo - visivel sem nenhum clique. Condicional apenas para lost e stolen.

Decisao arquitetural: Nao virou aba. Card visivel. Motivo: o Centro de Atividade precisa ser visto sem clique. Se virar aba, escondemos justamente a prova de que o sistema esta trabalhando.

Commit: a76e841

---

SPRINT B1 - FUNDACAO DO SISTEMA VIVO (CONCLUIDA)

1. Tabela object_events criada no Supabase

Migration executada em producao. Arquivo: docs/migrations/object_events.sql

Estrutura final:
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
  object_id   UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE
  user_id     UUID NULL REFERENCES users(id) ON DELETE SET NULL
  type        TEXT NOT NULL
  title       TEXT NOT NULL
  description TEXT NULL
  source      TEXT NOT NULL DEFAULT 'system'  -- system|owner|community|partner|admin|api|ai
  actor_type  TEXT NULL                        -- user|anonymous|b2b_partner|ai|admin
  actor_id    UUID NULL                        -- aponta para quem gerou a acao
  metadata    JSONB NOT NULL DEFAULT '{}'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()

Tres indices criados:
  idx_object_events_object_id_created_at  -- leitura por objeto (mais comum)
  idx_object_events_type_created_at       -- filtro por tipo de evento
  idx_object_events_actor (parcial WHERE actor_id IS NOT NULL) -- filtro por ator

Por que actor_type + actor_id: custo zero agora, evita migracao cara quando parceiros,
grupos Facebook, condominios e integracoes B2B chegarem. Um evento podera ser registrado
por system, owner, community, partner, admin, api ou ai, com rastreabilidade completa.

Classificacao de eventos por persistencia:
  Banco direto (MVP): object_created, object_published, object_indexed, matching_started,
    matching_completed, match_found, qr_scanned, owner_notified, boost_started,
    boost_expired, object_returned, status_changed.
  Buffer futuro (escala): public_view, map_impression, feed_impression, card_seen,
    hover, scroll, repeated_view.

Commit: 2412beb

2. src/lib/events.ts - helper fire-and-forget

Principio central: eventos sao inseridos de forma assincrona e nao-bloqueante.
A experiencia do usuario NUNCA espera pelo registro do evento.
Falha silenciosa - nunca bloqueia o fluxo principal.

Helpers semanticos implementados (12 total):
  Events.objectCreated(object_id, user_id)
  Events.objectPublished(object_id)
  Events.objectIndexed(object_id)
  Events.matchingStarted(object_id)
  Events.matchingCompleted(object_id, count)
  Events.matchFound(object_id, match_id, score)
  Events.qrScanned(object_id, metadata?)
  Events.ownerNotified(object_id, user_id)
  Events.boostStarted(object_id, user_id, boost_type, amount)
  Events.boostExpired(object_id)
  Events.objectReturned(object_id, user_id)
  Events.statusChanged(object_id, from, to, user_id?)

Commit: 20e5e10

3. Eventos plugados na criacao de objeto
   Arquivo: src/app/api/v1/objects/route.ts
   Apos normalizeObject, antes de enqueueSocialPosts:
     Events.objectCreated(newObject.id, payload.sub).catch(() => {});
     Events.objectPublished(newObject.id).catch(() => {});
     Events.objectIndexed(newObject.id).catch(() => {});
   A partir deste commit, cada novo objeto gera 3 eventos reais no banco.
   Commit: 2816749

4. Evento qrScanned plugado no scan de QR
   Arquivo: src/app/api/v1/objects/scan/[code]/route.ts
   Inserido no GET antes do return successResponse, fire-and-forget:
     Events.qrScanned(row.id as string).catch(() => {});
   A partir deste commit, cada scan de QR gera 1 evento real no banco.
   Commit: 308188c

---

OUTRAS ENTREGAS DESTA SESSAO

Sprint 002 - Tela de sucesso (/dashboard/objects/[id]/sucesso/page.tsx):
  - Bug cartaz: botao "Quadrado" chamava 'vertical' -> corrigido para 'square'
  - Reordenacao proximos passos: 1) WhatsApp, 2) Notificacoes, 3) Cartaz, 4) Mapa
  - Bloco monetizacao contextual (so lost/stolen): gradiente amber, CTA "Ampliar alcance"
  - WhatsApp loop progressivo: contador de grupos, nudge dinamico, feedback visual
  - Commit: b878124

Boost - copy contextual (/dashboard/objects/[id]/page.tsx):
  - Funcao getBoostCopy() com copy diferente por categoria:
    pet -> "Ampliar busca pelo pet"
    vehicle -> "Aumentar alerta do veiculo"
    stolen -> "Aumentar alerta de roubo"
    default -> "Aumentar alcance da ocorrencia"
  - Planos renomeados para linguagem de beneficio:
    "Alcance Essencial" R$9,90 | "Alerta Regional" R$14,90 | "Busca Intensiva" R$24,90
  - Microcopy: "Quanto antes mais pessoas souberem, melhor."
  - Microcopy honesto: "O Backfindr nao promete recuperacao, mas pode ampliar a exposicao."
  - Commit: bf5a257

---

### Estado do banco apos esta sessao

Tabela object_events criada e operacional em producao.
Cada novo cadastro gera automaticamente 3 eventos (created, published, indexed).
Cada scan de QR gera 1 evento (qr_scanned).

Para verificar dados reais:
  SELECT type, title, source, created_at
  FROM object_events
  ORDER BY created_at DESC
  LIMIT 20;

---

### Commits desta sessao (em ordem cronologica)

bf5a257 - feat: boost copy contextual por categoria
b878124 - feat: otimiza sucesso com proximos passos e oferta contextual
a76e841 - feat: Centro de Atividade da Ocorrencia - Sprint A
2412beb - feat: tabela object_events - motor de atividade do Sistema Vivo
20e5e10 - feat: events.ts - helper fire-and-forget para object_events
2816749 - feat: eventos objectCreated/Published/Indexed na criacao de objeto
308188c - feat: Events.qrScanned plugado no scan de QR

---

### Pendencias imediatas (proxima sessao)

CRITICO - Sprint 2 - Matching:
  Arquivo: src/app/api/v1/matching/run/route.ts
  Plugar: Events.matchingStarted, Events.matchingCompleted(count),
          Events.matchFound(match_id, score) para cada match.
  Sem esses eventos, a timeline mostra apenas criacao - nao o coracao do produto.

CRITICO - Sprint 4 - Endpoint leitura + ActivityCenterCard real:
  Criar: src/app/api/v1/objects/[id]/events/route.ts
  Atualizar ActivityCenterCard para consumir dados reais.
  ESTE E O PONTO DE INFLEXAO - quando o usuario ve o sistema trabalhando.

Sprint 3 - Eventos restantes (depois das sprints 2 e 4):
  Events.boostStarted no webhook Mercado Pago
  Events.statusChanged no PATCH de objeto
  Events.objectReturned quando status vai para returned

Documento docs/SISTEMA_VIVO.md - commitar (usar Python, nao heredoc).

---

### Pendencias anteriores mantidas

- Supabase analytics indexes (script 03/06/26)
- GSC: indexation report, robots.txt, canonicals /achados-perdidos
- tips_content enrichment com eventos locais (Festa Pessego/Mogi, Hanami/Suzano, etc)
- Seeds SEO esgotam ~46 dias a partir de 25/06 - repor antes do vencimento
- Google Business: data abertura 2010 -> 2026
- Bing Places, Capterra, Product Hunt
- Email reativacao para 14 usuarios reais de 2026 (todos cadastraram e nao voltaram)
- MarketplaceOS: R$ NaN pricing, broken ML URLs, Novo anuncio redirect

---

### Proxima sessao - inicio obrigatorio

  cd ~/Downloads/backfindr-local/backfindr-main
  cat BACKFINDR.md
  git log --oneline -10

Depois: ir direto para src/app/api/v1/matching/run/route.ts e plugar eventos de matching.


---

## Sessao 27/06/2026 - Sprints 2 e 4: Motor de Atividade Completo

### O que foi feito

SPRINT 2 - EVENTOS DE MATCHING (CONCLUIDA)
  Arquivo: src/app/api/v1/matching/run/route.ts
  Plugados 4 eventos fire-and-forget:
  - Events.matchingStarted(objectId) — antes do loop de candidatos
  - Events.matchingCompleted(objectId, candidatesResult.rows.length) — apos Promise.allSettled
  - Events.matchFound(objectId, newMatch.id, score) — dentro de processMatch, apos INSERT
  - Events.ownerNotified(lostObj.id, owner.id) — apos sendPushToUser, quando owner existe
  Commit: 3c32cc1

SPRINT 4 - ENDPOINT + ACTIVITYCENTERCARD REAL (CONCLUIDA)
  Arquivo criado: src/app/api/v1/objects/[id]/events/route.ts
  - GET autenticado, verifica ownership, retorna events[] + summary{}
  - Query principal: SELECT type, title, description, source, metadata, created_at ORDER BY created_at DESC LIMIT 20
  - Summary: total_scans, total_matches, total_ai_runs, last_activity
  Arquivo atualizado: src/components/object-detail/ActivityCenterCard.tsx
  - Consome dados reais via fetch /api/v1/objects/[id]/events
  - Usa Cookies.get('access_token') de js-cookie (padrao do projeto)
  - Summary em 3 cards: comparacoes IA / scans QR / correspondencias
  - Timeline real com icones por tipo de evento
  - Fallback gracioso para objetos sem eventos (estado inicial)
  - "Proxima comparacao automatica em andamento..." para objetos ativos
  Commit: 950f515

### Estado atual do Sistema Vivo

Sprint A: Centro de Atividade card visivel no dashboard ✅
Sprint B1: Tabela object_events + events.ts + eventos criacao/QR ✅
Sprint 2: Eventos matching plugados ✅
Sprint 4: Endpoint leitura + ActivityCenterCard dados reais ✅

Fluxo completo funcionando em producao:
  Cadastro objeto -> 3 eventos (created, published, indexed)
  Scan QR -> 1 evento (qr_scanned)
  Matching run -> matchingStarted + matchingCompleted(count) + matchFound(N) + ownerNotified
  Dashboard /objects/[id] -> card mostra timeline real + summary

### Pendentes desta sessao

Sprint 3 (proxima prioridade):
  Events.boostStarted no webhook Mercado Pago
  Events.statusChanged no PATCH de objeto
  Events.objectReturned quando status vai para returned

### Pendencias anteriores mantidas

- GSC: indexation report, robots.txt, canonicals /achados-perdidos
- Seeds SEO esgotam ~46 dias a partir de 25/06 - repor antes do vencimento
- Google Business: data abertura 2010 -> 2026
- Bing Places, Capterra, Product Hunt
- Email reativacao para 14 usuarios reais de 2026
- MarketplaceOS: R$ NaN pricing, broken ML URLs, Novo anuncio redirect
- Monetizacao — sessao dedicada (estrategia + design + copy + codigo)

### Proxima sessao - inicio obrigatorio

  cd ~/Downloads/backfindr-local/backfindr-main
  cat BACKFINDR.md
  git log --oneline -10

Depois: Sprint 3 — Events.boostStarted no webhook MP, Events.statusChanged no PATCH.
