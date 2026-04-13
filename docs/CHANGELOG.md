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

---

## Próximas Entregas Planejadas

Ver `PENDENCIAS.md` para o roadmap completo.
