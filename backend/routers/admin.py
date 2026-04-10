"""
routers/admin.py
Endpoints administrativos — estatísticas gerais do sistema.
Em produção: adicionar verificação de role admin no usuário.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.deps import get_current_user
from models import User, RegisteredObject, Match

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Total users
    users_result = await db.execute(select(func.count()).select_from(User))
    total_users = users_result.scalar() or 0

    # Objects by status
    objs_result = await db.execute(
        select(RegisteredObject.status, func.count())
        .group_by(RegisteredObject.status)
    )
    status_counts = dict(objs_result.fetchall())

    # Matches by status
    match_result = await db.execute(
        select(Match.status, func.count()).group_by(Match.status)
    )
    match_counts = dict(match_result.fetchall())

    total_objects = sum(status_counts.values())

    return {
        "total_users": total_users,
        "total_objects": total_objects,
        "lost_objects": status_counts.get("lost", 0),
        "found_objects": status_counts.get("found", 0),
        "returned_objects": status_counts.get("returned", 0),
        "stolen_objects": status_counts.get("stolen", 0),
        "pending_matches": match_counts.get("pending", 0),
        "confirmed_matches": match_counts.get("confirmed", 0),
        "rejected_matches": match_counts.get("rejected", 0),
    }
