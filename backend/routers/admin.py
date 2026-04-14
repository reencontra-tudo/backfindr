"""
routers/admin.py — Painel administrativo completo
Endpoints para dashboard, usuários, objetos, matches, B2B, financeiro.

IMPORTANTE: Em produção adicionar verificação de role admin no usuário.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc
from pydantic import BaseModel

from core.database import get_db
from core.deps import get_current_user
from models import User, RegisteredObject, Match

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Verificar permissão admin — em produção checar role específica."""
    # TODO: adicionar campo `is_admin` ou `role` no modelo User
    # Por ora apenas exige autenticação
    return current_user


# ─── STATS GERAIS ─────────────────────────────────────────────────────────────
@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    users_result  = await db.execute(select(func.count()).select_from(User))
    total_users   = users_result.scalar() or 0

    objs_result   = await db.execute(select(RegisteredObject.status, func.count()).group_by(RegisteredObject.status))
    status_counts = dict(objs_result.fetchall())

    match_result  = await db.execute(select(Match.status, func.count()).group_by(Match.status))
    match_counts  = dict(match_result.fetchall())

    total_objects = sum(status_counts.values())

    return {
        "total_users":       total_users,
        "new_users_today":   0,   # TODO: filtrar por date
        "new_users_week":    0,
        "active_users_week": 0,
        "total_objects":     total_objects,
        "lost_objects":      status_counts.get("lost", 0),
        "found_objects":     status_counts.get("found", 0),
        "returned_objects":  status_counts.get("returned", 0),
        "stolen_objects":    status_counts.get("stolen", 0),
        "pending_matches":   match_counts.get("pending", 0),
        "confirmed_matches": match_counts.get("confirmed", 0),
        "rejected_matches":  match_counts.get("rejected", 0),
        "total_scans_today": 0,   # TODO: tabela de scans
    }


# ─── USUÁRIOS ─────────────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    page:    int = Query(1, ge=1),
    size:    int = Query(20, ge=1, le=100),
    search:  Optional[str] = None,
    filter:  Optional[str] = None,
    db:      AsyncSession = Depends(get_db),
    _:       User = Depends(require_admin),
):
    q = select(User).order_by(desc(User.created_at))

    if search:
        q = q.where(or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))

    if filter == "pro":
        q = q.where(User.plan == "pro")
    elif filter == "legacy":
        q = q.where(User.is_legacy == True) if hasattr(User, "is_legacy") else q
    elif filter == "inactive":
        q = q.where(User.is_active == False)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0

    q = q.offset((page - 1) * size).limit(size)
    result = await db.execute(q)
    users = result.scalars().all()

    items = []
    for u in users:
        objs = await db.execute(select(func.count()).where(RegisteredObject.owner_id == u.id))
        items.append({
            "id":           str(u.id),
            "name":         u.name,
            "email":        u.email,
            "phone":        u.phone,
            "plan":         u.plan,
            "is_active":    u.is_active,
            "is_legacy":    getattr(u, "is_legacy", False),
            "created_at":   u.created_at.isoformat() if u.created_at else None,
            "objects_count": objs.scalar() or 0,
        })

    return { "items": items, "total": total, "page": page, "size": size }


class UserUpdate(BaseModel):
    is_active: Optional[bool] = None
    plan:      Optional[str]  = None


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    payload: UserUpdate,
    db:      AsyncSession = Depends(get_db),
    _:       User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.plan is not None:
        user.plan = payload.plan

    await db.commit()
    return { "success": True, "user_id": user_id }


# ─── OBJETOS ──────────────────────────────────────────────────────────────────
@router.get("/objects")
async def list_objects(
    page:   int = Query(1, ge=1),
    size:   int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    user:   Optional[str] = None,
    db:     AsyncSession = Depends(get_db),
    _:      User = Depends(require_admin),
):
    q = select(RegisteredObject, User.name.label("owner_name"), User.email.label("owner_email")) \
        .join(User, RegisteredObject.owner_id == User.id) \
        .order_by(desc(RegisteredObject.created_at))

    if search:
        q = q.where(or_(
            RegisteredObject.title.ilike(f"%{search}%"),
            RegisteredObject.unique_code.ilike(f"%{search}%"),
            User.name.ilike(f"%{search}%"),
        ))
    if status:
        q = q.where(RegisteredObject.status == status)
    if user:
        q = q.where(RegisteredObject.owner_id == user)

    total_q = select(func.count()).select_from(q.subquery())
    total   = (await db.execute(total_q)).scalar() or 0

    q = q.offset((page - 1) * size).limit(size)
    rows = (await db.execute(q)).all()

    items = []
    for obj, owner_name, owner_email in rows:
        items.append({
            "id":           str(obj.id),
            "title":        obj.title,
            "category":     obj.category,
            "status":       obj.status,
            "unique_code":  obj.unique_code,
            "location_addr":obj.location_addr,
            "owner_name":   owner_name,
            "owner_email":  owner_email,
            "is_legacy":    getattr(obj, "is_legacy", False),
            "created_at":   obj.created_at.isoformat() if obj.created_at else None,
        })

    return { "items": items, "total": total }


class ObjectUpdate(BaseModel):
    status: Optional[str] = None


@router.patch("/objects/{object_id}")
async def update_object(
    object_id: str,
    payload:   ObjectUpdate,
    db:        AsyncSession = Depends(get_db),
    _:         User = Depends(require_admin),
):
    result = await db.execute(select(RegisteredObject).where(RegisteredObject.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Objeto não encontrado")
    if payload.status:
        obj.status = payload.status
    await db.commit()
    return { "success": True }


@router.delete("/objects/{object_id}")
async def delete_object(
    object_id: str,
    db:        AsyncSession = Depends(get_db),
    _:         User = Depends(require_admin),
):
    result = await db.execute(select(RegisteredObject).where(RegisteredObject.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Objeto não encontrado")
    await db.delete(obj)
    await db.commit()
    return { "success": True }


# ─── MATCHES ──────────────────────────────────────────────────────────────────
@router.get("/matches")
async def list_matches(
    status: Optional[str] = None,
    page:   int = Query(1, ge=1),
    size:   int = Query(30, ge=1, le=100),
    db:     AsyncSession = Depends(get_db),
    _:      User = Depends(require_admin),
):
    q = select(Match, RegisteredObject.title.label("object_title"), RegisteredObject.status.label("object_status")) \
        .join(RegisteredObject, Match.object_id == RegisteredObject.id) \
        .order_by(desc(Match.created_at))

    if status:
        q = q.where(Match.status == status)

    total_q = select(func.count()).select_from(q.subquery())
    total   = (await db.execute(total_q)).scalar() or 0

    q = q.offset((page - 1) * size).limit(size)
    rows = (await db.execute(q)).all()

    items = []
    for match, obj_title, obj_status in rows:
        # Buscar objeto matched
        matched_result = await db.execute(select(RegisteredObject).where(RegisteredObject.id == match.matched_object_id))
        matched = matched_result.scalar_one_or_none()
        items.append({
            "id":                str(match.id),
            "status":            match.status,
            "confidence_score":  match.confidence_score,
            "object_title":      obj_title,
            "object_status":     obj_status,
            "matched_title":     matched.title if matched else "—",
            "matched_status":    matched.status if matched else "—",
            "created_at":        match.created_at.isoformat() if match.created_at else None,
        })

    return { "items": items, "total": total }
