# Scripts de Migração — Webjetos → Backfindr

## webjetos_migration_alters.sql

Script SQL para adicionar colunas de migração nas tabelas do Backfindr.
Já foi executado no Supabase em 13/04/2026.

**Para reexecutar (seguro — usa IF NOT EXISTS em tudo):**
```
psql $DATABASE_URL -f webjetos_migration_alters.sql
```

## reativar_usuarios_webjetos.py

Script Python para enviar e-mails de reativação para usuários migrados do Webjetos.

**Pré-requisitos:**
```
pip install psycopg2-binary python-dotenv resend tqdm
```

**Variáveis de ambiente necessárias:**
```
PG_URL=postgresql://...
RESEND_KEY=re_xxxxxxxxxxxx
APP_URL=https://backfindr.com.br
FROM_EMAIL=noreply@backfindr.com.br
```

**Uso:**
```bash
# Dry run (não envia e-mails)
python reativar_usuarios_webjetos.py --dry-run

# Testar com um e-mail específico
python reativar_usuarios_webjetos.py --only-email marcos@exemplo.com

# Enviar para todos os usuários legados
python reativar_usuarios_webjetos.py

# Limitar quantidade
python reativar_usuarios_webjetos.py --limit 100
```
