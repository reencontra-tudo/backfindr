"""
routers/google_auth.py
Google OAuth2 — troca o code pelo token, cria ou autentica o usuário.

Dependências:
  pip install google-auth google-auth-oauthlib google-auth-httplib2

Variáveis de ambiente necessárias:
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  APP_URL (para o redirect_uri)
"""
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from core.database import get_db
from core.security import create_access_token, create_refresh_token
from core.config import settings
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleCallbackPayload(BaseModel):
    code: str
    redirect_uri: str


@router.post("/google/callback")
async def google_callback(payload: GoogleCallbackPayload, db: AsyncSession = Depends(get_db)):
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
    client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth não configurado")

    # 1. Trocar code por access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(GOOGLE_TOKEN_URL, data={
            "code": payload.code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": payload.redirect_uri,
            "grant_type": "authorization_code",
        })

    if token_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Falha ao autenticar com Google")

    token_data = token_response.json()
    google_access_token = token_data.get("access_token")

    # 2. Buscar dados do usuário
    async with httpx.AsyncClient() as client:
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"}
        )

    if userinfo_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Falha ao obter dados do usuário Google")

    userinfo = userinfo_response.json()
    google_email = userinfo.get("email")
    google_name = userinfo.get("name", google_email)
    google_picture = userinfo.get("picture")

    if not google_email:
        raise HTTPException(status_code=400, detail="Email não disponível no Google")

    # 3. Buscar ou criar usuário
    result = await db.execute(select(User).where(User.email == google_email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            id=uuid.uuid4(),
            name=google_name,
            email=google_email,
            password="",  # Sem senha — login apenas via OAuth
            avatar_url=google_picture,
            is_active=True,
            plan="free",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Atualizar avatar se necessário
        if google_picture and not user.avatar_url:
            user.avatar_url = google_picture
            await db.commit()

    # 4. Retornar tokens JWT
    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "plan": user.plan,
        }
    }
