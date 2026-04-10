import uuid
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db, AsyncSessionLocal
from core.deps import get_current_user, get_current_user_ws
from models import User, Match, ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])


# ─── Connection Manager ───────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        self.rooms.setdefault(room, []).append(websocket)

    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.rooms:
            self.rooms[room] = [ws for ws in self.rooms[room] if ws != websocket]
            if not self.rooms[room]:
                del self.rooms[room]

    async def broadcast(self, room: str, message: dict, exclude: Optional[WebSocket] = None):
        dead = []
        for ws in self.rooms.get(room, []):
            if ws == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, room)

    async def send_personal(self, websocket: WebSocket, message: dict):
        await websocket.send_json(message)


manager = ConnectionManager()


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/{match_id}")
async def chat_ws(websocket: WebSocket, match_id: str):
    token = websocket.query_params.get("token")

    async with AsyncSessionLocal() as db:
        user = await get_current_user_ws(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        result = await db.execute(select(Match).where(Match.id == match_id))
        match = result.scalar_one_or_none()
        if not match:
            await websocket.close(code=4004)
            return

        # Load history
        hist_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.match_id == match_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(50)
        )
        history = hist_result.scalars().all()

    await manager.connect(websocket, match_id)

    try:
        await manager.send_personal(websocket, {
            "type": "history",
            "messages": [
                {
                    "id": str(m.id),
                    "sender_id": str(m.sender_id),
                    "sender_name": m.sender_name,
                    "content": m.content,
                    "created_at": m.created_at.isoformat(),
                    "is_system": m.is_system,
                }
                for m in history
            ],
        })

        await manager.broadcast(match_id, {
            "type": "presence",
            "user_id": str(user.id),
            "user_name": user.name,
            "status": "online",
        })

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "message")

            if msg_type == "message":
                content = data.get("content", "").strip()
                if not content or len(content) > 2000:
                    continue

                async with AsyncSessionLocal() as db:
                    msg = ChatMessage(
                        id=uuid.uuid4(),
                        match_id=match_id,
                        sender_id=user.id,
                        sender_name=user.name,
                        content=content,
                        created_at=datetime.utcnow(),
                    )
                    db.add(msg)
                    await db.commit()
                    msg_id = str(msg.id)
                    msg_ts = msg.created_at.isoformat()

                await manager.broadcast(match_id, {
                    "type": "message",
                    "id": msg_id,
                    "sender_id": str(user.id),
                    "sender_name": user.name,
                    "content": content,
                    "created_at": msg_ts,
                    "is_system": False,
                })

            elif msg_type == "typing":
                await manager.broadcast(match_id, {
                    "type": "typing",
                    "user_id": str(user.id),
                    "user_name": user.name,
                }, exclude=websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id)
        await manager.broadcast(match_id, {
            "type": "presence",
            "user_id": str(user.id),
            "user_name": user.name,
            "status": "offline",
        })


# ─── REST — history ───────────────────────────────────────────────────────────

@router.get("/{match_id}/messages")
async def get_messages(
    match_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.match_id == match_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(min(limit, 100))
    )
    messages = result.scalars().all()
    return {
        "items": [
            {
                "id": str(m.id),
                "sender_id": str(m.sender_id),
                "sender_name": m.sender_name,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
                "is_system": m.is_system,
            }
            for m in reversed(messages)
        ]
    }
