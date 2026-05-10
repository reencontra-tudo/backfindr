# Changelog — Backfindr

Registro cronológico de todas as alterações significativas na plataforma.

---

## [2026-04-13] — Sessão de Correções e Melhorias

### Domínios e DNS
- Adicionado domínio `backfindr.com.br` ao projeto no Vercel
- Corrigido registro `A` do `backfindr.com.br` no GoDaddy: `76.76.21.21` → `216.198.79.1`
- Corrigido `CNAME www` do `backfindr.com.br` no GoDaddy: `cname.vercel-dns.com` → `2559923009931a6d.vercel-dns-017.com`
- Adicionados domínios `backfindr.com`, `backfindr.online` e `backfindr.app` ao projeto no Vercel
- Todos os 9 domínios/subdomínios agora com status **Valid Configuration** no Vercel

### Email (Resend)
- Criado domínio `backfindr.com.br` no Resend com região `sa-east-1` (São Paulo)
- Adicionados registros DNS no GoDaddy: DKIM (TXT), MX e SPF para o subdomínio `send`

### Correções de Bug — Mapa e Dados Migrados
- **Problema:** API `/objects/public` retornava `{ objects: [...] }` mas frontend esperava `{ items: [...] }`
  - **Correção:** Padronizado para `{ items, total, page, size, pages }` em todas as rotas
- **Problema:** Mapa só exibia objetos com `status = 'lost'`
  - **Correção:** Rota pública agora inclui todos os status (lost, found, stolen, returned)
- **Problema:** Dados migrados do Webjetos têm `latitude`/`longitude` separados, mas mapa esperava `location.lat`/`location.lng`
  - **Correção:** Adicionada função `normalizeObject()` em todas as rotas de objetos
- **Problema:** Mapa plotava pontos antes do evento `load` do Mapbox
  - **Correção:** Adicionado estado `mapLoaded` — pontos só são plotados após o mapa estar pronto
- **Problema:** Campo `category` não era retornado (apenas `type`)
  - **Correção:** Retorna `category || type || 'other'` para compatibilidade com dados legados
- **Problema:** URL da API hardcoded como `https://backfindr.vercel.app` causava Network Error em outros domínios
  - **Correção:** URL alterada para relativa (`/api/v1`), funcionando em todos os domínios

### Copy da Home Page
- Atualizado o copywriting da Home Page com textos mais impactantes e emocionais:
  - Hero: "Se você perder, já pode ser tarde demais."
  - CTA Final: "Depois que perde, não adianta cadastrar."
  - Seção emocional: "Celular, mochila, cachorro… E não tinha nada pra te ajudar."

### Redesign Premium da Home Page
- Adicionado mockup interativo no Hero com notificação flutuante animada e badge de scan
- Adicionada seção emocional com cards de Celular, Mochila e Pet
- Adicionada seção dedicada para Pets com benefícios e CTA exclusivo
- Adicionada seção Empresas com 4 métricas e CTA para vendas
- Implementadas animações fade-in ao rolar em todas as seções com delays escalonados
- CTA Final com gradiente radial e glow teal
- Footer atualizado com link para o Mapa
- Navbar atualizada com link "Para pets"

### Documentação Viva (`/docs`)
- Criada estrutura `/docs` no repositório com:
  - `OVERVIEW.md`: visão geral da plataforma (stack, domínios, banco, funcionalidades)
  - `CHANGELOG.md`: registro cronológico de todas as alterações
  - `PENDENCIAS.md`: roadmap de melhorias com status e prioridade

### Painel Business (B2B)
- Criada rota `/api/v1/business/stats` com analytics de ativos por status, categoria e recuperações
- Criada página `/dashboard/business` com:
  - 4 cards de resumo (total de ativos, taxa de recuperação, QR scaneados, matches)
  - Gráfico de barras por status
  - Breakdown por categoria
  - Lista dos 10 ativos mais recentes
  - CTA para suporte dedicado
- Link "Painel Business" adicionado ao sidebar do dashboard (visível apenas para plano `business`)
- Tipo `User.plan` atualizado para incluir `'business'`

### Otimização do Matching Geoespacial
- Substituída a fórmula de diferença de graus (imprecisa) pela **fórmula de Haversine**
- Adicionado filtro geoespacial em SQL: candidatos agora são pré-filtrados por raio de **50km** antes do scoring em JavaScript
- Resultado: redução drástica no número de comparações (de todos os objetos para apenas os próximos)
- Sem dependência de PostGIS — funciona em qualquer PostgreSQL padrão

### Limpeza de Código
- Removido hook `useChat.ts` legado (WebSocket não utilizado em nenhuma página)

### Mapa Interativo — Popup com Resumo da Publicação
- Ao tocar/clicar em um ponto no mapa, exibe popup com resumo da ocorrência:
  - Emoji da categoria, título, badge de status colorido, descrição truncada
  - Badge dourado de recompensa (quando `reward_amount > 0`)
  - Botão "Ver detalhes / Contactar dono" com link para `/scan/{code}`
- Lista lateral: ícone de presente dourado ao lado de objetos com recompensa

### Sistema de Recompensas
- Adicionadas colunas `reward_amount` (NUMERIC 10,2) e `reward_description` (TEXT) ao banco via migration
- Formulário de novo objeto: campo de recompensa no Step 2, visível apenas para status `lost`
- Dashboard de detalhe: badge dourado com valor e mensagem da recompensa
- Página pública de scan: badge de recompensa visível para quem encontrou o objeto
- APIs atualizadas: `/objects`, `/objects/public`, `/objects/scan/{code}`, `/objects/{id}` (GET e PATCH)
- Rota de migration: `POST /api/v1/admin/migrate` com suporte a JWT de admin ou `MIGRATION_SECRET`

### Etiquetas para Impressão
- Botão "Imprimir etiqueta (85×55mm)" adicionado ao componente QR Code no dashboard
- Abre janela de impressão com etiqueta no formato cartão de crédito (85×55mm)
- Etiqueta contém: QR Code colorido, nome do objeto, código único, URL de scan e marca Backfindr
- Compatível com impressoras de etiquetas e impressão em folha A4

### Compressão de Imagens no Upload
- Compressão automática client-side antes do envio (Canvas API)
- Redimensionamento máximo: 1200px, qualidade JPEG 82%
- Redução média de 60–80% no tamanho do arquivo

### Bot Assistente Findr
- Bot de atendimento com fluxo guiado de cadastro de objetos perdidos
- Integrado com OpenAI GPT para respostas contextuais
- Disponível em `/dashboard/assistant`

### Compartilhamento Social
- Botão de compartilhamento na página pública de scan
- Suporte a WhatsApp, Facebook, X (Twitter), Telegram, LinkedIn, Email e Instagram Stories
- Cópia de link com toast de confirmação

---

## Próximas Entregas Planejadas

Ver `PENDENCIAS.md` para o roadmap completo.
