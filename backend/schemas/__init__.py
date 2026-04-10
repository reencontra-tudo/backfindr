from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ─── Auth ─────────────────────────────────────────────────────────────────────

class RegisterPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    phone: Optional[str] = None


class LoginPayload(BaseModel):
    username: str  # OAuth2 form uses 'username'
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshPayload(BaseModel):
    refresh_token: str


# ─── User ─────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str]
    avatar_url: Optional[str]
    plan: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


# ─── Objects ──────────────────────────────────────────────────────────────────

class LocationIn(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None


class ObjectCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10)
    category: str
    status: str = "lost"
    location: Optional[LocationIn] = None
    pet_species: Optional[str] = None
    pet_breed: Optional[str] = None
    pet_color: Optional[str] = None
    pet_microchip: Optional[str] = None


class ObjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    location: Optional[LocationIn] = None
    pet_species: Optional[str] = None
    pet_breed: Optional[str] = None
    pet_color: Optional[str] = None
    pet_microchip: Optional[str] = None


class ObjectOut(BaseModel):
    id: UUID
    title: str
    description: str
    category: str
    status: str
    owner_id: UUID
    unique_code: str
    photos: List[str]
    location: Optional[dict] = None
    pet_species: Optional[str]
    pet_breed: Optional[str]
    pet_color: Optional[str]
    pet_microchip: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedObjects(BaseModel):
    items: List[ObjectOut]
    total: int
    page: int
    size: int
    pages: int


# ─── Matches ──────────────────────────────────────────────────────────────────

class MatchOut(BaseModel):
    id: UUID
    object_id: UUID
    matched_object_id: UUID
    confidence_score: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedMatches(BaseModel):
    items: List[MatchOut]
    total: int


# ─── Chat ─────────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: UUID
    match_id: UUID
    sender_id: UUID
    sender_name: str
    content: str
    is_system: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Notifications ────────────────────────────────────────────────────────────

class PushSubscribePayload(BaseModel):
    endpoint: str
    keys: dict  # p256dh, auth


class NotificationOut(BaseModel):
    id: UUID
    type: str
    title: str
    body: str
    url: Optional[str]
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedNotifications(BaseModel):
    items: List[NotificationOut]
    total: int
    unread: int
