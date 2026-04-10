import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey, Text, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name       = Column(String(120), nullable=False)
    email      = Column(String(255), unique=True, nullable=False, index=True)
    phone      = Column(String(30), nullable=True)
    password   = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    plan       = Column(String(20), default="free")
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    objects       = relationship("RegisteredObject", back_populates="owner", cascade="all, delete-orphan")
    push_tokens   = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class RegisteredObject(Base):
    __tablename__ = "objects"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title         = Column(String(200), nullable=False)
    description   = Column(Text, nullable=False)
    category      = Column(String(50), nullable=False)
    status        = Column(String(20), default="lost", nullable=False, index=True)
    owner_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    unique_code   = Column(String(12), unique=True, nullable=False, index=True)
    photos        = Column(JSON, default=list)
    location_lat  = Column(Float, nullable=True)
    location_lng  = Column(Float, nullable=True)
    location_addr = Column(String(500), nullable=True)
    # Pet fields (F20)
    pet_species   = Column(String(50), nullable=True)
    pet_breed     = Column(String(100), nullable=True)
    pet_color     = Column(String(100), nullable=True)
    pet_microchip = Column(String(50), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner   = relationship("User", back_populates="objects")
    matches = relationship("Match", foreign_keys="Match.object_id", back_populates="object", cascade="all, delete-orphan")


class Match(Base):
    __tablename__ = "matches"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_id         = Column(UUID(as_uuid=True), ForeignKey("objects.id", ondelete="CASCADE"), nullable=False, index=True)
    matched_object_id = Column(UUID(as_uuid=True), ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    confidence_score  = Column(Float, default=0.0)
    status            = Column(String(20), default="pending")  # pending | confirmed | rejected
    created_at        = Column(DateTime, default=datetime.utcnow)

    object         = relationship("RegisteredObject", foreign_keys=[object_id], back_populates="matches")
    matched_object = relationship("RegisteredObject", foreign_keys=[matched_object_id])
    messages       = relationship("ChatMessage", back_populates="match", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id    = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sender_name = Column(String(120), nullable=False)
    content     = Column(Text, nullable=False)
    is_system   = Column(Boolean, default=False)
    read_at     = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    match = relationship("Match", back_populates="messages")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint   = Column(Text, nullable=False, unique=True)
    p256dh     = Column(Text, nullable=False)
    auth       = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="push_tokens")


class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type       = Column(String(30), nullable=False)  # match | scan | message | returned | system
    title      = Column(String(200), nullable=False)
    body       = Column(Text, nullable=False)
    url        = Column(String(500), nullable=True)
    read       = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
