from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from core.config import settings
from core.database import engine, Base
from routers import auth, objects, matches, users, health

# Criar tabelas (apenas em desenvolvimento local; em produção use Alembic migrações)
# Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Backfindr API",
    description="API da plataforma Backfindr – recuperação de objetos perdidos",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router,      prefix="/api/v1/auth",    tags=["auth"])
app.include_router(objects.router,   prefix="/api/v1/objects", tags=["objects"])
app.include_router(matches.router,   prefix="/api/v1/matches", tags=["matches"])
app.include_router(users.router,     prefix="/api/v1/users",   tags=["users"])

@app.get("/")
def root():
    return {"status": "ok", "message": "Backfindr API online"}

# Handler para Vercel (AWS Lambda / serverless)
handler = Mangum(app, lifespan="off")
