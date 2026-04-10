import uuid
import os
import string
import random
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.deps import get_current_user, get_optional_user
from core.config import settings
from models import User, RegisteredObject, Notification
from schemas import ObjectOut, ObjectUpdate, PaginatedObjects
from routers.notifications import send_push_to_user

router = APIRouter(prefix="/objects", tags=["objects"])

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def generate_unique_code(length: int = 8) -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


def object_to_dict(obj: RegisteredObject) -> dict:
    d = {
        "id": str(obj.id),
        "title": obj.title,
        "description": obj.description,
        "category": obj.category,
        "status": obj.status,
        "owner_id": str(obj.owner_id),
        "unique_code": obj.unique_code,
        "photos": obj.photos or [],
        "pet_species": obj.pet_species,
        "pet_breed": obj.pet_breed,
        "pet_color": obj.pet_color,
        "pet_microchip": obj.pet_microchip,
        "created_at": obj.created_at.isoformat(),
        "updated_at": obj.updated_at.isoformat(),
    }
    if obj.location_lat and obj.location_lng:
        d["location"] = {
            "lat": obj.location_lat,
            "lng": obj.location_lng,
            "address": obj.location_addr,
        }
    else:
        d["location"] = None
    return d


@router.get("", response_model=PaginatedObjects)
async def list_objects(
    status: Optional[str] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(RegisteredObject).where(RegisteredObject.owner_id == current_user.id)
    if status:
        query = query.where(RegisteredObject.status == status)
    if category:
        query = query.where(RegisteredObject.category == category)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.order_by(RegisteredObject.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    objects = result.scalars().all()

    return {
        "items": [object_to_dict(o) for o in objects],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.get("/public")
async def list_public(
    status: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 50,
    size: int = Query(200, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(RegisteredObject).where(
        RegisteredObject.status.in_(["lost", "found"])
    )
    if status:
        query = query.where(RegisteredObject.status == status)

    query = query.order_by(RegisteredObject.created_at.desc()).limit(size)
    result = await db.execute(query)
    objects = result.scalars().all()
    return {"items": [object_to_dict(o) for o in objects]}


@router.get("/scan/{code}")
async def scan_object(code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RegisteredObject).where(RegisteredObject.unique_code == code)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Objeto não encontrado")
    return object_to_dict(obj)


@router.post("/scan/{code}/notify")
async def notify_owner(code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RegisteredObject).where(RegisteredObject.unique_code == code)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Objeto não encontrado")

    # Create in-app notification
    notif = Notification(
        id=uuid.uuid4(),
        user_id=obj.owner_id,
        type="scan",
        title="Seu objeto foi encontrado! 🎉",
        body=f'Alguém encontrou "{obj.title}" e está aguardando seu contato.',
        url=f"/dashboard/objects/{obj.id}",
    )
    db.add(notif)
    await db.commit()

    # Try push notification
    try:
        await send_push_to_user(
            user_id=str(obj.owner_id),
            title="Objeto encontrado! 🎉",
            body=f'"{obj.title}" foi encontrado por alguém.',
            url=f"/dashboard/objects/{obj.id}",
            db=db,
        )
    except Exception:
        pass  # Push is best-effort

    return {"detail": "Dono notificado com sucesso"}


@router.post("", status_code=201)
async def create_object(
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    status: str = Form("lost"),
    location: Optional[str] = Form(None),
    pet_species: Optional[str] = Form(None),
    pet_breed: Optional[str] = Form(None),
    pet_color: Optional[str] = Form(None),
    pet_microchip: Optional[str] = Form(None),
    photos: list[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Generate unique code
    code = generate_unique_code()
    while True:
        result = await db.execute(
            select(RegisteredObject).where(RegisteredObject.unique_code == code)
        )
        if not result.scalar_one_or_none():
            break
        code = generate_unique_code()

    # Parse location
    lat = lng = addr = None
    if location:
        import json
        try:
            loc = json.loads(location)
            lat, lng, addr = loc.get("lat"), loc.get("lng"), loc.get("address")
        except Exception:
            pass

    # Save photos
    photo_urls = []
    upload_dir = os.path.join(settings.LOCAL_UPLOAD_DIR, "objects")
    os.makedirs(upload_dir, exist_ok=True)

    for photo in photos[:5]:  # max 5
        ext = (photo.filename or "").rsplit(".", 1)[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            continue
        filename = f"{uuid.uuid4()}.{ext}"
        path = os.path.join(upload_dir, filename)
        content = await photo.read()
        if len(content) > MAX_FILE_SIZE:
            continue
        with open(path, "wb") as f:
            f.write(content)
        photo_urls.append(f"/uploads/objects/{filename}")

    obj = RegisteredObject(
        id=uuid.uuid4(),
        title=title,
        description=description,
        category=category,
        status=status,
        owner_id=current_user.id,
        unique_code=code,
        photos=photo_urls,
        location_lat=lat,
        location_lng=lng,
        location_addr=addr,
        pet_species=pet_species,
        pet_breed=pet_breed,
        pet_color=pet_color,
        pet_microchip=pet_microchip,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    # Dispara matching em background automaticamente
    try:
        from routers.matching import run_matching_for_object
        import asyncio
        asyncio.create_task(run_matching_for_object(str(obj.id), db))
    except Exception:
        pass  # Matching é best-effort, não bloqueia o registro

    return object_to_dict(obj)


@router.get("/{object_id}")
async def get_object(
    object_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(RegisteredObject).where(
            RegisteredObject.id == object_id,
            RegisteredObject.owner_id == current_user.id,
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Objeto não encontrado")
    return object_to_dict(obj)


@router.patch("/{object_id}")
async def update_object(
    object_id: str,
    payload: ObjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(RegisteredObject).where(
            RegisteredObject.id == object_id,
            RegisteredObject.owner_id == current_user.id,
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Objeto não encontrado")

    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "location" and value:
            obj.location_lat = value.get("lat")
            obj.location_lng = value.get("lng")
            obj.location_addr = value.get("address")
        else:
            setattr(obj, field, value)

    await db.commit()
    await db.refresh(obj)
    return object_to_dict(obj)


@router.delete("/{object_id}", status_code=204)
async def delete_object(
    object_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(RegisteredObject).where(
            RegisteredObject.id == object_id,
            RegisteredObject.owner_id == current_user.id,
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Objeto não encontrado")
    await db.delete(obj)
    await db.commit()
