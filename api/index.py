import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add backend to path
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.config import settings
from backend.core.database import engine, Base
from backend.models import User, RegisteredObject, Match, ChatMessage, PushSubscription, Notification  # noqa
from backend.routers.health import router as health_router
from backend.routers.auth import router as auth_router
from backend.routers.google_auth import router as google_auth_router
from backend.routers.password_reset import router as password_reset_router
from backend.routers.users import router as users_router
from backend.routers.public_profile import router as public_profile_router
from backend.routers.objects import router as objects_router
from backend.routers.matches import router as matches_router
from backend.routers.matching import router as matching_router
from backend.routers.notifications import router as notifications_router
from backend.routers.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Backfindr API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(health_router)
app.include_router(auth_router, prefix=PREFIX)
app.include_router(google_auth_router, prefix=PREFIX)
app.include_router(password_reset_router, prefix=PREFIX)
app.include_router(users_router, prefix=PREFIX)
app.include_router(public_profile_router, prefix=PREFIX)
app.include_router(objects_router, prefix=PREFIX)
app.include_router(matches_router, prefix=PREFIX)
app.include_router(matching_router, prefix=PREFIX)
app.include_router(notifications_router, prefix=PREFIX)
app.include_router(admin_router, prefix=PREFIX)


@app.get("/")
async def root():
    return {"service": "Backfindr API", "version": "1.0.0"}
