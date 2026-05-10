# Backfindr — Handoff para Desenvolvedor

Plataforma global de recuperação de objetos perdidos com QR Code, IA de matching e chat mediado.

---

## Setup em 3 comandos

```bash
# 1. Configure as variáveis de ambiente
cp backend/.env.example backend/.env
cp web/.env.example web/.env.local
# Edite os dois arquivos com seus valores reais

# 2. Suba tudo com Docker
docker compose up --build

# 3. Acesse
# API:  http://localhost:8000/docs
# Web:  http://localhost:3000
```

---

## Estrutura do Projeto

```
backfindr/
├── backend/               # FastAPI + PostgreSQL + Redis
│   ├── main.py            # Entry point — todos os routers registrados
│   ├── core/              # config, database, security, deps
│   ├── models/            # SQLAlchemy ORM (User, Object, Match, Chat, Notification, Push)
│   ├── schemas/           # Pydantic schemas
│   ├── routers/           # auth, users, objects, matches, chat, notifications, health
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
│
├── web/                   # Next.js 14 App Router
│   ├── src/
│   │   ├── app/           # 12 rotas (landing, auth, dashboard, scan, map)
│   │   ├── hooks/         # useAuth, useChat
│   │   ├── lib/           # api.ts (axios + todos endpoints)
│   │   └── types/         # tipos TypeScript do domínio
│   ├── public/            # sw.js (Service Worker), manifest.json
│   ├── .env.example
│   └── Dockerfile
│
├── mobile/                # React Native + Expo 51
│   ├── src/
│   │   ├── screens/       # Auth, Dashboard, Objects, Scan, Profile
│   │   ├── hooks/         # useAuth
│   │   ├── lib/           # api.ts, theme.ts
│   │   ├── navigation/    # TabsLayout (5 tabs)
│   │   └── types/
│   ├── app.config.ts
│   └── package.json
│
└── docker-compose.yml
```

---

## Variáveis de Ambiente Obrigatórias

### Backend (`backend/.env`)
| Variável | Descrição |
|---|---|
| `DATABASE_URL` | PostgreSQL async — `postgresql+asyncpg://user:pass@host/db` |
| `REDIS_URL` | Redis — `redis://localhost:6379` |
| `SECRET_KEY` | Mínimo 32 chars aleatórios |
| `CORS_ORIGINS` | JSON array com origens permitidas |

### Web (`web/.env.local`)
| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL do backend |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token Mapbox GL JS (mapbox.com, free tier) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública VAPID para push (opcional) |

### Mobile (`mobile/.env`)
| Variável | Descrição |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL do backend |

---

## Setup Push Notifications (opcional)

```bash
# Gerar par de chaves VAPID
pip install py-vapid
python -c "
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print('PRIVATE:', v.private_key)
print('PUBLIC:', v.public_key)
"
# Adicionar ao backend/.env e web/.env.local
```

---

## Deploy Recomendado

| Serviço | Plataforma |
|---|---|
| Backend + DB + Redis | Railway (1 clique, free tier) |
| Web | Vercel (conectar repositório) |
| Mobile | EAS Build (`npx eas build`) |
| Uploads | Cloudflare R2 (mudar `STORAGE_BACKEND=r2`) |

---

## Rotas da API

```
GET    /health
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/users/me
PATCH  /api/v1/users/me
GET    /api/v1/objects
POST   /api/v1/objects
GET    /api/v1/objects/public
GET    /api/v1/objects/scan/{code}
POST   /api/v1/objects/scan/{code}/notify
GET    /api/v1/objects/{id}
PATCH  /api/v1/objects/{id}
DELETE /api/v1/objects/{id}
GET    /api/v1/matches
POST   /api/v1/matches/{id}/confirm
POST   /api/v1/matches/{id}/reject
WS     /api/v1/chat/ws/{match_id}?token=...
GET    /api/v1/chat/{match_id}/messages
GET    /api/v1/notifications
PATCH  /api/v1/notifications/{id}/read
POST   /api/v1/notifications/read-all
DELETE /api/v1/notifications/{id}
POST   /api/v1/notifications/subscribe
POST   /api/v1/notifications/unsubscribe
```

Documentação interativa disponível em `http://localhost:8000/docs`

---

## Rotas Web

| Rota | Descrição | Auth |
|---|---|---|
| `/` | Landing page | ❌ |
| `/auth/login` | Login | ❌ |
| `/auth/register` | Cadastro | ❌ |
| `/map` | Mapa público | ❌ |
| `/scan/[code]` | Scan de QR Code | ❌ |
| `/dashboard` | Overview | ✅ |
| `/dashboard/objects` | Lista de objetos | ✅ |
| `/dashboard/objects/new` | Wizard de registro | ✅ |
| `/dashboard/objects/[id]` | Detalhes + QR Code | ✅ |
| `/dashboard/matches` | Matches da IA | ✅ |
| `/dashboard/chat/[matchId]` | Chat mediado | ✅ |
| `/dashboard/notifications` | Notificações | ✅ |

---

## Próximos Passos Pós-Deploy

- [ ] Configurar domínios backfindr.com / backfindr.com.br / backfindr.app
- [ ] Habilitar SSL (automático no Railway/Vercel)
- [ ] Configurar Sentry para monitoramento de erros
- [ ] Implementar o algoritmo de IA de matching (atual: stub no backend)
- [ ] Google OAuth (adicionar NextAuth.js)
- [ ] Submeter app mobile às stores (EAS Submit)
