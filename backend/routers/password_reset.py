"""
routers/password_reset.py
Fluxo de recuperação de senha por e-mail.

Requer:
  pip install emails python-jose[cryptography]

Variáveis de ambiente:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
  FROM_EMAIL (padrão: noreply@backfindr.com)
  APP_URL
"""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from jose import jwt

from core.database import get_db
from core.config import settings
from core.security import hash_password
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

RESET_TOKEN_EXPIRE_MINUTES = 30
RESET_SECRET = settings.SECRET_KEY + "-reset"


class ForgotPayload(BaseModel):
    email: EmailStr


class ResetPayload(BaseModel):
    token: str
    password: str


def create_reset_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "reset"},
        RESET_SECRET,
        algorithm="HS256",
    )


def verify_reset_token(token: str):
    try:
        payload = jwt.decode(token, RESET_SECRET, algorithms=["HS256"])
        if payload.get("type") != "reset":
            return None
        return payload.get("sub")
    except Exception:
        return None


async def send_reset_email(email: str, name: str, token: str):
    """Envia e-mail de recuperação. Em dev, apenas loga o link."""
    reset_url = f"{settings.APP_URL}/auth/reset-password?token={token}"

    # Log em desenvolvimento
    import logging
    logging.getLogger("backfindr").info(f"RESET LINK for {email}: {reset_url}")

    # Em produção: configurar SMTP ou serviço de e-mail (SendGrid, Resend, etc.)
    smtp_host = getattr(settings, "SMTP_HOST", "")
    if not smtp_host:
        return  # Skip em dev

    try:
        import emails
        message = emails.html(
            html=f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
              <h2 style="color:#14b8a6">Recuperar senha — Backfindr</h2>
              <p>Olá, {name}!</p>
              <p>Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo:</p>
              <a href="{reset_url}"
                 style="display:inline-block;background:#14b8a6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:20px 0">
                Redefinir senha
              </a>
              <p style="color:#666;font-size:13px">
                Este link expira em 30 minutos. Se você não solicitou, ignore este e-mail.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
              <p style="color:#999;font-size:12px">Backfindr — Recupere o que você perdeu.</p>
            </div>
            """,
            subject="Redefinir senha do Backfindr",
            mail_from=getattr(settings, "FROM_EMAIL", "noreply@backfindr.com"),
        )
        smtp_settings = {
            "host": smtp_host,
            "port": int(getattr(settings, "SMTP_PORT", 587)),
            "user": getattr(settings, "SMTP_USER", ""),
            "password": getattr(settings, "SMTP_PASSWORD", ""),
            "tls": True,
        }
        message.send(to=email, smtp=smtp_settings)
    except Exception as e:
        import logging
        logging.getLogger("backfindr").error(f"Failed to send reset email: {e}")


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Sempre retorna 200 para não revelar se o e-mail existe
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        token = create_reset_token(str(user.id))
        background_tasks.add_task(send_reset_email, user.email, user.name, token)

    return {"detail": "Se o e-mail estiver cadastrado, você receberá um link em instantes."}


@router.post("/reset-password")
async def reset_password(payload: ResetPayload, db: AsyncSession = Depends(get_db)):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Senha deve ter no mínimo 8 caracteres")

    user_id = verify_reset_token(payload.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user.password = hash_password(payload.password)
    await db.commit()

    return {"detail": "Senha redefinida com sucesso"}
