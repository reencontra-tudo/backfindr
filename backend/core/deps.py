from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from core.database import get_db
from core.security import decode_token
from models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    subject = decode_token(token)
    if not subject:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == subject))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exception
    return user


async def get_current_user_ws(
    token: Optional[str],
    db: AsyncSession,
) -> Optional[User]:
    """Auth for WebSocket connections — token passed as query param."""
    if not token:
        return None
    subject = decode_token(token)
    if not subject:
        return None
    result = await db.execute(select(User).where(User.id == subject))
    user = result.scalar_one_or_none()
    return user if (user and user.is_active) else None


async def get_optional_user(
    token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None
