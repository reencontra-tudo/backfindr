import sys
import os

# Adicionar o diretório backend ao path para que as importações funcionem
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from mangum import Mangum

from core.config import settings
from core.database import engine, Base

# Import all models so Alembic can detect them
from models import User, RegisteredObject, Match, ChatMessage, PushSubscription, Notification  # noqa

# Routers
from routers.health import router as health_router
from routers.auth import router as auth_router
from routers.google_auth import router as google_auth_router
from routers.password_reset import router as password_reset_router
from routers.users import router as users_router
from routers.public_profile import router as public_profile_router
from routers.objects import router as objects_router
from routers.matches import router as matches_router
from routers.matching import router as matching_router
from routers.chat import router as chat_router
from routers.notifications import router as notifications_router
from routers.admin import router as admin_router

app = FastAPI(
    title="Backfindr API",
    version="1.0.0",
    description="Plataforma global de recuperação de objetos perdidos",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static files (local uploads) ────────────────────────────────────────────
os.makedirs(settings.LOCAL_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.LOCAL_UPLOAD_DIR), name="uploads")

# ─── Routers ──────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(health_router, prefix=PREFIX, tags=["health"])
app.include_router(auth_router, prefix=PREFIX, tags=["auth"])
app.include_router(google_auth_router, prefix=PREFIX, tags=["google_auth"])
app.include_router(password_reset_router, prefix=PREFIX, tags=["password_reset"])
app.include_router(users_router, prefix=PREFIX, tags=["users"])
app.include_router(public_profile_router, prefix=PREFIX, tags=["public_profile"])
app.include_router(objects_router, prefix=PREFIX, tags=["objects"])
app.include_router(matches_router, prefix=PREFIX, tags=["matches"])
app.include_router(matching_router, prefix=PREFIX, tags=["matching"])
app.include_router(chat_router, prefix=PREFIX, tags=["chat"])
app.include_router(notifications_router, prefix=PREFIX, tags=["notifications"])
app.include_router(admin_router, prefix=PREFIX, tags=["admin"])

@app.get("/")
def root():
    return {"status": "ok", "message": "Backfindr API online"}

# Handler para Vercel (AWS Lambda / serverless)
handler = Mangum(app, lifespan="off")
