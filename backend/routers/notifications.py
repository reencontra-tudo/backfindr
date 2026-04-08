import uuid
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from core.database import get_db
from core.deps import get_current_user
from core.config import settings
from models import User, Notification, PushSubscription
from schemas import PushSubscribePayload, NotificationOut, PaginatedNotifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── Push utility (called by other routers) ───────────────────────────────────

async def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    db: AsyncSession,
    url: str = "/dashboard",
    tag: str = "backfindr",
):
    """Send push notification to all subscriptions of a user."""
    if not settings.VAPID_PRIVATE_KEY:
        return  # Push not configured

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subscriptions = result.scalars().all()

    try:
        from pywebpush import webpush, WebPushException
        payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})

        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIMS_EMAIL}"},
                )
            except WebPushException as ex:
                if ex.response and ex.response.status_code == 410:
                    # Subscription expired — remove
                    await db.delete(sub)
    except ImportError:
        pass  # pywebpush not available


# ─── REST endpoints ───────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedNotifications)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    unread_result = await db.execute(
        select(func.count()).where(
            Notification.user_id == current_user.id,
            Notification.read == False,
        )
    )
    unread = unread_result.scalar()

    return {"items": items, "total": len(items), "unread": unread}


@router.patch("/{notif_id}/read")
async def mark_read(
    notif_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    notif.read = True
    await db.commit()
    return {"detail": "Marcada como lida"}


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read == False)
        .values(read=True)
    )
    await db.commit()
    return {"detail": "Todas marcadas como lidas"}


@router.delete("/{notif_id}", status_code=204)
async def delete_notification(
    notif_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        await db.delete(notif)
        await db.commit()


@router.post("/subscribe")
async def subscribe_push(
    payload: PushSubscribePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {"detail": "Já inscrito"}

    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=current_user.id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.get("p256dh", ""),
        auth=payload.keys.get("auth", ""),
    )
    db.add(sub)
    await db.commit()
    return {"detail": "Inscrito com sucesso"}


@router.post("/unsubscribe")
async def unsubscribe_push(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    endpoint = payload.get("endpoint")
    if endpoint:
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.endpoint == endpoint)
        )
        sub = result.scalar_one_or_none()
        if sub:
            await db.delete(sub)
            await db.commit()
    return {"detail": "Desinscrito"}
