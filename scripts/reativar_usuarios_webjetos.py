"""
reativar_usuarios_webjetos.py
─────────────────────────────────────────────────────────────────────────────
Script de reativação de usuários migrados do Webjetos para o Backfindr.

O que faz:
  1. Busca todos os usuários com is_legacy=true e is_active=true no Backfindr
  2. Envia e-mail personalizado de reativação via Resend
  3. Gera token de redefinição de senha (válido 7 dias)
  4. Registra log de envio em CSV local

Pré-requisitos:
  pip install psycopg2-binary python-dotenv resend tqdm

Variáveis de ambiente (.env ou export):
  PG_URL       = postgresql://user:senha@host:5432/backfindr
  RESEND_KEY   = re_xxxxxxxxxxxx
  APP_URL      = https://backfindr.com.br
  FROM_EMAIL   = noreply@backfindr.com.br
  BATCH_SIZE   = 50   (opcional, default 50)
  DRY_RUN      = true (opcional, não envia e-mails)

Uso:
  python reativar_usuarios_webjetos.py
  python reativar_usuarios_webjetos.py --dry-run
  python reativar_usuarios_webjetos.py --limit 100
  python reativar_usuarios_webjetos.py --only-email marcos@exemplo.com
"""

import argparse
import csv
import logging
import os
import secrets
import sys
from datetime import datetime, timedelta
from pathlib import Path

import psycopg2
import psycopg2.extras
import resend
from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

# ─── Config ──────────────────────────────────────────────────────────────────
PG_URL      = os.getenv("PG_URL", "")
RESEND_KEY  = os.getenv("RESEND_KEY", "")
APP_URL     = os.getenv("APP_URL", "https://backfindr.com.br").rstrip("/")
FROM_EMAIL  = os.getenv("FROM_EMAIL", "noreply@backfindr.com.br")
BATCH_SIZE  = int(os.getenv("BATCH_SIZE", "50"))
TOKEN_DAYS  = 7

LOG_FILE    = Path("reativacao_log.csv")
ERROR_FILE  = Path("reativacao_erros.csv")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


# ─── E-mail template ─────────────────────────────────────────────────────────
def build_email_html(name: str, reset_url: str) -> str:
    first_name = name.split()[0] if name else "olá"
    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu histórico chegou ao Backfindr</title>
</head>
<body style="margin:0;padding:0;background:#080b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#14b8a6);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
                <span style="font-size:16px;">📍</span>
              </div>
              <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">Backfindr</span>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">
              Oi, {first_name}! Seu histórico chegou 👋
            </h1>
            <p style="color:rgba(255,255,255,0.4);font-size:15px;line-height:1.6;margin:0 0 24px;">
              Você usou o <strong style="color:rgba(255,255,255,0.7);">Webjetos</strong> para registrar objetos perdidos e achados.
              Migramos todo o seu histórico para o <strong style="color:#14b8a6;">Backfindr</strong> — nossa nova plataforma,
              com IA de matching, QR Code único e chat protegido.
            </p>

            <!-- Features -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="padding:12px;background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.15);border-radius:12px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    {''.join(f"""
                    <tr>
                      <td style="padding:8px 0;">
                        <span style="font-size:18px;">{icon}</span>
                        <span style="color:rgba(255,255,255,0.7);font-size:14px;margin-left:10px;">{text}</span>
                      </td>
                    </tr>""" for icon, text in [
                        ("✅", "Seus registros históricos foram preservados"),
                        ("🤖", "IA cruza automaticamente perdidos com achados"),
                        ("🔐", "QR Code único — funciona sem app, para sempre"),
                        ("💬", "Chat mediado — seu contato nunca é exposto"),
                    ])}
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <p style="color:rgba(255,255,255,0.4);font-size:14px;margin:0 0 16px;">
              Para acessar sua conta, crie uma nova senha:
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#14b8a6;border-radius:10px;box-shadow:0 0 0 1px rgba(20,184,166,0.5),0 8px 24px rgba(20,184,166,0.25);">
                  <a href="{reset_url}" style="display:inline-block;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;">
                    Acessar minha conta →
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0 0 8px;">
              Este link é válido por {TOKEN_DAYS} dias. Se não reconhece esta conta, ignore este e-mail.
            </p>
            <p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0;word-break:break-all;">
              {reset_url}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">
              © 2026 Backfindr · São Paulo, Brasil ·
              <a href="{APP_URL}/privacy" style="color:rgba(20,184,166,0.6);text-decoration:none;">Privacidade</a> ·
              <a href="{APP_URL}/terms" style="color:rgba(20,184,166,0.6);text-decoration:none;">Termos</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def build_email_text(name: str, reset_url: str) -> str:
    first_name = name.split()[0] if name else "olá"
    return f"""
Oi, {first_name}!

Seu histórico do Webjetos chegou ao Backfindr.

Migramos todos os seus registros para nossa nova plataforma com IA de matching,
QR Code único e chat protegido.

Para acessar sua conta, crie uma nova senha:
{reset_url}

Este link é válido por {TOKEN_DAYS} dias.

Se não reconhece esta conta, ignore este e-mail.

© 2026 Backfindr · backfindr.com.br
"""


# ─── DB helpers ──────────────────────────────────────────────────────────────
def get_legacy_users(conn, limit: int | None, only_email: str | None) -> list[dict]:
    where = ["u.is_legacy = true", "u.is_active = true"]
    params: list = []

    if only_email:
        where.append("u.email = %s")
        params.append(only_email)

    query = f"""
        SELECT u.id, u.name, u.email
        FROM users u
        WHERE {' AND '.join(where)}
        ORDER BY u.created_at ASC
        {'LIMIT %s' if limit else ''}
    """
    if limit:
        params.append(limit)

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query, params)
        return [dict(r) for r in cur.fetchall()]


def save_reset_token(conn, user_id: str, token: str, expires_at: datetime) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO password_reset_tokens (user_id, token, expires_at, used)
            VALUES (%s, %s, %s, false)
            ON CONFLICT (user_id) DO UPDATE
              SET token = EXCLUDED.token,
                  expires_at = EXCLUDED.expires_at,
                  used = false
        """, (user_id, token, expires_at))
    conn.commit()


def ensure_token_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                user_id   uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                token     varchar(64) NOT NULL UNIQUE,
                expires_at timestamptz NOT NULL,
                used      boolean DEFAULT false,
                created_at timestamptz DEFAULT now()
            )
        """)
    conn.commit()


# ─── CSV logging ─────────────────────────────────────────────────────────────
def init_csv(path: Path, headers: list[str]) -> None:
    if not path.exists():
        with open(path, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(headers)


def append_csv(path: Path, row: list) -> None:
    with open(path, "a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(row)


# ─── Main ─────────────────────────────────────────────────────────────────────
def main(dry_run: bool, limit: int | None, only_email: str | None) -> None:
    # Validate config
    if not PG_URL:
        log.error("PG_URL não definido. Exporte a variável de ambiente.")
        sys.exit(1)
    if not RESEND_KEY and not dry_run:
        log.error("RESEND_KEY não definido. Use --dry-run ou configure a chave.")
        sys.exit(1)

    resend.api_key = RESEND_KEY

    log.info(f"Conectando ao banco... {'[DRY RUN]' if dry_run else ''}")
    conn = psycopg2.connect(PG_URL)

    ensure_token_table(conn)

    users = get_legacy_users(conn, limit, only_email)
    log.info(f"{len(users)} usuário(s) legado(s) encontrado(s)")

    if not users:
        log.info("Nada a fazer.")
        conn.close()
        return

    init_csv(LOG_FILE, ["timestamp", "user_id", "email", "nome", "status", "message_id"])
    init_csv(ERROR_FILE, ["timestamp", "user_id", "email", "erro"])

    sent = 0
    errors = 0
    expires_at = datetime.utcnow() + timedelta(days=TOKEN_DAYS)

    for user in tqdm(users, desc="Enviando e-mails"):
        token = secrets.token_urlsafe(32)
        reset_url = f"{APP_URL}/auth/reset-password?token={token}"
        uid = str(user["id"])

        try:
            if not dry_run:
                save_reset_token(conn, uid, token, expires_at)

                resp = resend.Emails.send({
                    "from": f"Backfindr <{FROM_EMAIL}>",
                    "to": [user["email"]],
                    "subject": "Seu histórico do Webjetos chegou ao Backfindr 📍",
                    "html": build_email_html(user["name"], reset_url),
                    "text": build_email_text(user["name"], reset_url),
                })
                message_id = resp.get("id", "")
            else:
                message_id = "DRY_RUN"
                log.info(f"  [dry-run] {user['email']} → {reset_url[:60]}...")

            append_csv(LOG_FILE, [
                datetime.utcnow().isoformat(),
                uid, user["email"], user["name"],
                "sent", message_id,
            ])
            sent += 1

        except Exception as e:
            log.error(f"Erro ao processar {user['email']}: {e}")
            append_csv(ERROR_FILE, [
                datetime.utcnow().isoformat(),
                uid, user["email"], str(e),
            ])
            errors += 1

    conn.close()

    log.info("─" * 50)
    log.info(f"✅ Enviados : {sent}")
    log.info(f"❌ Erros    : {errors}")
    log.info(f"📄 Log      : {LOG_FILE}")
    if errors:
        log.info(f"⚠️  Erros    : {ERROR_FILE}")


# ─── CLI ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reativar usuários migrados do Webjetos")
    parser.add_argument("--dry-run",     action="store_true",  help="Não envia e-mails nem salva tokens")
    parser.add_argument("--limit",       type=int, default=None, help="Limitar quantidade de usuários")
    parser.add_argument("--only-email",  type=str, default=None, help="Processar apenas este e-mail (teste)")
    args = parser.parse_args()

    main(dry_run=args.dry_run, limit=args.limit, only_email=args.only_email)
