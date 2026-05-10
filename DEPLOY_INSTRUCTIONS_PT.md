# 🚀 Instruções de Deploy - Backfindr

## Passo 1: Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Preencha os dados:
   - **Repository name:** `backfindr`
   - **Description:** "Global object recovery platform"
   - **Public:** Selecione esta opção
3. Clique em **"Create repository"**

## Passo 2: Fazer Upload do Código

### Opção A: Via GitHub Web Interface (Mais Fácil)
1. No seu novo repositório, clique em **"Add file"** → **"Upload files"**
2. Arraste e solte todos os arquivos do projeto
3. Clique em **"Commit changes"**

### Opção B: Via Git CLI (Para Desenvolvedores)
```bash
git clone https://github.com/seu-usuario/backfindr.git
cd backfindr
# Copie todos os arquivos do projeto para esta pasta
git add .
git commit -m "Initial commit: Backfindr project"
git push -u origin main
```

## Passo 3: Deploy do Backend no Render

1. Acesse https://render.com
2. Faça login com sua conta
3. Clique em **"New +"** → **"Web Service"**
4. Selecione **"Deploy an existing repository"**
5. Conecte seu repositório GitHub `backfindr`
6. Preencha:
   - **Name:** `backfindr-api`
   - **Environment:** `Python 3.11`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
7. Adicione as variáveis de ambiente (Environment):
   ```
   DATABASE_URL=postgresql://user:password@host/backfindr
   REDIS_URL=redis://default:password@host:6379
   JWT_SECRET=sua-chave-secreta-aqui
   OPENAI_API_KEY=sk-...
   MAPBOX_TOKEN=pk_...
   STRIPE_SECRET_KEY=sk_...
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   ```
8. Clique em **"Create Web Service"**

## Passo 4: Deploy do Frontend no Vercel

1. Acesse https://vercel.com
2. Faça login com sua conta
3. Clique em **"Add New"** → **"Project"**
4. Selecione seu repositório `backfindr`
5. Preencha:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `./web`
6. Adicione as variáveis de ambiente:
   ```
   NEXT_PUBLIC_API_URL=https://backfindr-api.onrender.com
   NEXT_PUBLIC_MAPBOX_TOKEN=pk_...
   ```
7. Clique em **"Deploy"**

## Passo 5: Deploy do Mobile (Opcional)

1. Instale EAS CLI: `npm install -g eas-cli`
2. Faça login: `eas login`
3. Na pasta `mobile`, execute: `eas build --platform ios` ou `eas build --platform android`

## Variáveis de Ambiente Necessárias

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost/backfindr
REDIS_URL=redis://localhost:6379
JWT_SECRET=sua-chave-secreta-super-segura
JWT_EXPIRATION=86400
OPENAI_API_KEY=sk-seu-token-aqui
MAPBOX_TOKEN=pk_seu-token-aqui
STRIPE_SECRET_KEY=sk_seu-token-aqui
STRIPE_PUBLISHABLE_KEY=pk_seu-token-aqui
TWILIO_ACCOUNT_SID=seu-sid-aqui
TWILIO_AUTH_TOKEN=seu-token-aqui
TWILIO_PHONE_NUMBER=+5511999999999
ENVIRONMENT=production
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://backfindr-api.onrender.com
NEXT_PUBLIC_MAPBOX_TOKEN=pk_seu-token-aqui
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_seu-token-aqui
```

## Obtendo as Chaves Necessárias

### Mapbox Token
1. Acesse https://account.mapbox.com/tokens/
2. Crie um novo token com escopos: `styles:read`, `datasets:read`, `maps:read`

### Stripe Keys
1. Acesse https://dashboard.stripe.com/apikeys
2. Copie as chaves de teste ou produção

### OpenAI API Key
1. Acesse https://platform.openai.com/api-keys
2. Crie uma nova chave

### Twilio Credentials
1. Acesse https://www.twilio.com/console
2. Copie Account SID e Auth Token

## Verificar Deploy

### Backend
- Acesse: `https://backfindr-api.onrender.com/health`
- Deve retornar: `{"status": "healthy"}`

### Frontend
- Acesse: `https://backfindr.vercel.app`
- Deve carregar a página inicial

## Troubleshooting

### Erro: "Repository not found"
- Verifique se o repositório é público
- Verifique se o token do GitHub tem permissões corretas

### Erro: "Build failed"
- Verifique se o arquivo `requirements.txt` existe
- Verifique se o `package.json` está correto

### Erro: "Environment variables not set"
- Adicione todas as variáveis na seção de Environment do Render/Vercel
- Reinicie o deploy após adicionar as variáveis

## Próximos Passos

1. Configure um domínio customizado
2. Ative HTTPS
3. Configure backups automáticos do banco de dados
4. Implemente CI/CD com GitHub Actions
5. Configure monitoramento e alertas

---

**Suporte:** Para dúvidas, consulte a documentação completa em `README.md`
