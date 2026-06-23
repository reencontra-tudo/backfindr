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
