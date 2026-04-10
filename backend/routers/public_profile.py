"""
routers/public_profile.py
Perfil público de usuário — stats de recuperação, sinal de confiança.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from models import User, RegisteredObject

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/public")
async def get_public_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Stats
    total_result = await db.execute(
        select(func.count()).where(RegisteredObject.owner_id == user_id)
    )
    total = total_result.scalar() or 0

    returned_result = await db.execute(
        select(func.count()).where(
            RegisteredObject.owner_id == user_id,
            RegisteredObject.status == "returned",
        )
    )
    returned = returned_result.scalar() or 0

    # Objetos que ele achou e devolveu (status found → returned com owner diferente)
    found_returned_result = await db.execute(
        select(func.count()).where(
            RegisteredObject.owner_id == user_id,
            RegisteredObject.status == "returned",
            RegisteredObject.category != None,  # placeholder
        )
    )
    found_returned = found_returned_result.scalar() or 0

    return {
        "id": str(user.id),
        "name": user.name,
        "avatar_url": user.avatar_url,
        "plan": user.plan,
        "created_at": user.created_at.isoformat(),
        "stats": {
            "objects_registered": total,
            "objects_returned": returned,
            "found_and_returned": found_returned,
        },
    }
