from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.deps import get_current_user
from models import User, Match, RegisteredObject
from schemas import PaginatedMatches

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=PaginatedMatches)
async def list_matches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Matches where user owns one of the objects
    subq = select(RegisteredObject.id).where(RegisteredObject.owner_id == current_user.id)
    query = select(Match).where(
        Match.object_id.in_(subq) | Match.matched_object_id.in_(subq)
    ).order_by(Match.created_at.desc())

    result = await db.execute(query)
    matches = result.scalars().all()

    return {"items": matches, "total": len(matches)}


@router.post("/{match_id}/confirm")
async def confirm_match(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match não encontrado")

    match.status = "confirmed"
    await db.commit()
    return {"detail": "Match confirmado"}


@router.post("/{match_id}/reject")
async def reject_match(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match não encontrado")

    match.status = "rejected"
    await db.commit()
    return {"detail": "Match rejeitado"}
