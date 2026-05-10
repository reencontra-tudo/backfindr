# Backfindr — Módulos Portaria, Custody e Delivery

Documentação técnica para o desenvolvedor responsável pela implementação.

---

## 1. O que foi adicionado

### Arquivos novos

```
src/
├── db/
│   └── migrations/
│       └── 002_portaria_custody_delivery.sql   ← Schema das novas tabelas
├── lib/
│   └── notifyModulos.ts                         ← Helpers de notificação + WhatsApp + geofencing
├── types/
│   └── modulos.ts                               ← Tipos TypeScript dos novos módulos
└── app/api/v1/
    ├── portaria/
    │   ├── migrate/route.ts                     ← Criar tabelas via endpoint
    │   ├── condominios/route.ts                 ← CRUD de condomínios (admin)
    │   ├── condominios/[slug]/route.ts          ← Buscar por slug (público)
    │   ├── condominios/[slug]/join/route.ts     ← Morador se vincula
    │   └── [condominioId]/
    │       ├── dashboard/route.ts               ← Painel do porteiro
    │       ├── encomendas/route.ts              ← Registrar e listar encomendas
    │       ├── encomendas/[id]/confirmar/route.ts ← Confirmar retirada
    │       └── custodias/route.ts               ← Scan QR de custódia
    ├── custody/
    │   ├── items/route.ts                       ← Criar e listar custódias
    │   ├── items/[id]/route.ts                  ← Detalhe com eventos
    │   ├── scan/[qrCode]/route.ts               ← Escanear QR (porteiro/entregador)
    │   ├── link/[token]/route.ts                ← Destinatário acessa link
    │   └── confirmar/[token]/route.ts           ← Confirmar retirada
    └── delivery/
        ├── estabelecimentos/route.ts            ← CRUD de estabelecimentos
        ├── entregas/route.ts                    ← Criar e listar entregas
        ├── entregas/[id]/status/route.ts        ← Atualizar status
        ├── entregas/[id]/localizacao/route.ts   ← Geofencing automático
        ├── link/[token]/route.ts                ← Cliente acompanha entrega
        └── confirmar/[token]/route.ts           ← Cliente confirma recebimento
```

---

## 2. Setup — Passo a Passo

### 2.1 Criar as tabelas no banco

**Opção A — Supabase SQL Editor (recomendado):**
1. Acesse o painel do Supabase
2. Vá em SQL Editor → New Query
3. Cole o conteúdo de `src/db/migrations/002_portaria_custody_delivery.sql`
4. Execute

**Opção B — Via endpoint:**
```bash
curl -X POST https://backfindr.com/api/v1/portaria/migrate \
  -H "x-migration-secret: $MIGRATION_SECRET"
```

### 2.2 Variáveis de ambiente

Adicionar ao `.env` (ver `.env.example`):
```
ZAPI_URL=https://api.z-api.io/instances/ID/token/TOKEN
ZAPI_TOKEN=seu_token
ZAPI_CLIENT_TOKEN=seu_client_token
```

> Para o piloto, Z-API é suficiente.
> Para escalar com administradoras, substituir pela Meta API oficial.

---

## 3. Fluxos Completos

### 3.1 Portaria — Encomenda

```
POST /api/v1/portaria/{condominioId}/encomendas
  → registra encomenda
  → notifica morador (push + WhatsApp)

PATCH /api/v1/portaria/{condominioId}/encomendas/{id}/confirmar
  → marca como entregue
  → notifica morador da retirada
```

### 3.2 Portaria — Custódia de objeto

```
POST /api/v1/custody/items          (morador cria, gera QR + link)
POST /api/v1/portaria/{id}/custodias  (porteiro escaneia QR → status: custodiado)
GET  /api/v1/custody/link/{token}   (destinatário acessa link)
POST /api/v1/custody/confirmar/{token} (destinatário confirma retirada)
```

### 3.3 Custody — Standalone (sem condomínio)

```
POST /api/v1/custody/items          (remetente cria item)
POST /api/v1/custody/scan/{qrCode}  (custodiante escaneia)
POST /api/v1/custody/confirmar/{token} (destinatário confirma)
```

### 3.4 Delivery — Entrega com Geofencing

```
POST /api/v1/delivery/entregas                    (criar entrega → envia link ao cliente)
PATCH /api/v1/delivery/entregas/{id}/status       (saiu | proximo | na_portaria)
POST /api/v1/delivery/entregas/{id}/localizacao   (entregador envia GPS → geofencing automático)
GET  /api/v1/delivery/link/{token}                (cliente acompanha)
POST /api/v1/delivery/confirmar/{token}           (cliente confirma recebimento)
```

**Raios de geofencing automáticos:**
- 500m → status `proximo` + notificação "está chegando"
- 100m → alerta WhatsApp "quase chegando"
- 30m  → status `na_portaria` + notificação automática

---

## 4. Autenticação e Roles

| Role          | Acesso                                              |
|---------------|-----------------------------------------------------|
| `super_admin` | Tudo                                                |
| `admin`       | Criar condomínios, estabelecimentos, ver todos      |
| `b2b_admin`   | Dashboard do próprio condomínio/parceiro            |
| `user`        | Criar custódias, fazer join no condomínio, delivery |
| `porteiro`*   | Dashboard + encomendas + scan QR do condomínio      |

*`porteiro` é um user comum vinculado via tabela `porteiros` — não é uma role separada no JWT. A verificação é feita via query na tabela `porteiros`.

---

## 5. Tabelas Novas

| Módulo   | Tabelas                                              |
|----------|------------------------------------------------------|
| Portaria | `condominios`, `unidades`, `porteiros`, `encomendas` |
| Custody  | `custodias`, `custody_eventos`                       |
| Delivery | `estabelecimentos`, `entregadores`, `entregas`, `entrega_eventos` |

Todas referenciam `users` e `b2b_partners` via FK — sem dependências novas.

---

## 6. WhatsApp — Integração

O helper `enviarWhatsApp()` em `src/lib/notifyModulos.ts` é um stub configurável:

- **Piloto**: Z-API — configurar `ZAPI_URL`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`
- **Produção**: substituir o corpo da função pela Meta Cloud API
- **Sem config**: falha silenciosa com log — não quebra o fluxo principal

---

## 7. Geofencing — Como Funciona

A função `calcularDistanciaMetros()` em `notifyModulos.ts` usa a fórmula de Haversine para calcular a distância entre dois pontos GPS. É chamada a cada atualização de localização do entregador via `POST /api/v1/delivery/entregas/{id}/localizacao`.

O frontend do entregador deve chamar este endpoint a cada 10–15 segundos enquanto a entrega estiver ativa (status `saiu` ou `proximo`).

---

## 8. Pendências para o Desenvolvedor

- [ ] PWA do porteiro — telas de scan, encomendas e custódia (protótipo visual já existe)
- [ ] Página pública `/custody/[token]` — destinatário confirma retirada
- [ ] Página pública `/delivery/[token]` — cliente acompanha entrega em tempo real (mapa)
- [ ] Painel `/parceiro/portaria` — estender o portal B2B existente
- [ ] Integração OCR real (Google Vision API) na rota de encomendas
- [ ] Ativar geolocalização no app do entregador (permissão temporária)
- [ ] Substituir Z-API pela Meta API quando escalar para administradoras
