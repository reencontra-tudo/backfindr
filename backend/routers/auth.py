import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from core.deps import get_current_user
from models import User
from schemas import RegisterPayload, TokenResponse, RefreshPayload, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: RegisterPayload, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = User(
        id=uuid.uuid4(),
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form.password, user.password):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta desativada")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshPayload, db: AsyncSession = Depends(get_db)):
    subject = decode_token(payload.refresh_token)
    if not subject:
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    result = await db.execute(select(User).where(User.id == subject))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    # Stateless JWT — client deletes tokens
    return {"detail": "Logout realizado"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
