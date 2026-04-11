from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
import secrets
import hashlib

# ─── Models ───────────────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: str
    password_confirm: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str
    created_at: datetime

class ObjectCreate(BaseModel):
    title: str
    description: str
    category: str
    status: str  # "lost" or "found"
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class RegisteredObject(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    category: str
    status: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    image_url: Optional[str] = None

# ─── In-Memory Database ───────────────────────────────────────────────────────
users_db: dict = {}
objects_db: dict = {}
sessions_db: dict = {}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token() -> str:
    return secrets.token_urlsafe(32)

# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Backfindr API",
    version="1.0.0",
    description="Plataforma global de recuperação de objetos perdidos",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "message": "Backfindr API is online",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/")
def root():
    return {"status": "ok", "message": "Backfindr API online"}

# ─── Auth Endpoints ───────────────────────────────────────────────────────────
@app.post("/api/v1/auth/register")
def register(user_data: UserRegister):
    # Validar senha
    if len(user_data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha deve ter no mínimo 8 caracteres"
        )
    
    if user_data.password != user_data.password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senhas não conferem"
        )
    
    # Verificar se email já existe
    if any(u["email"] == user_data.email for u in users_db.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email já cadastrado"
        )
    
    # Criar novo usuário
    user_id = generate_token()
    users_db[user_id] = {
        "id": user_id,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.now().isoformat()
    }
    
    # Criar sessão
    token = generate_token()
    sessions_db[token] = {
        "user_id": user_id,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(days=30)
    }
    
    return {
        "success": True,
        "message": "Usuário criado com sucesso",
        "user": {
            "id": user_id,
            "email": user_data.email,
            "full_name": user_data.full_name
        },
        "token": token
    }

@app.post("/api/v1/auth/login")
def login(credentials: UserLogin):
    # Procurar usuário
    user = None
    user_id = None
    for uid, u in users_db.items():
        if u["email"] == credentials.email:
            user = u
            user_id = uid
            break
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    # Verificar senha
    if user["password_hash"] != hash_password(credentials.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    # Criar sessão
    token = generate_token()
    sessions_db[token] = {
        "user_id": user_id,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(days=30)
    }
    
    return {
        "success": True,
        "message": "Login realizado com sucesso",
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "full_name": user["full_name"]
        }
    }

# ─── Objects Endpoints ─────────────────────────────────────────────────────────
@app.get("/api/v1/objects")
def list_objects(skip: int = 0, limit: int = 10, status_filter: Optional[str] = None):
    """Lista objetos perdidos/encontrados"""
    objects_list = list(objects_db.values())
    
    if status_filter:
        objects_list = [o for o in objects_list if o["status"] == status_filter]
    
    return {
        "success": True,
        "total": len(objects_list),
        "objects": objects_list[skip:skip+limit]
    }

@app.post("/api/v1/objects")
def create_object(obj_data: ObjectCreate, token: Optional[str] = None):
    """Criar novo objeto perdido/encontrado"""
    if not token or token not in sessions_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autorizado"
        )
    
    session = sessions_db[token]
    user_id = session["user_id"]
    
    obj_id = generate_token()
    objects_db[obj_id] = {
        "id": obj_id,
        "user_id": user_id,
        "title": obj_data.title,
        "description": obj_data.description,
        "category": obj_data.category,
        "status": obj_data.status,
        "location": obj_data.location,
        "latitude": obj_data.latitude,
        "longitude": obj_data.longitude,
        "created_at": datetime.now().isoformat(),
        "image_url": None
    }
    
    return {
        "success": True,
        "message": "Objeto criado com sucesso",
        "object": objects_db[obj_id]
    }

@app.get("/api/v1/objects/{object_id}")
def get_object(object_id: str):
    """Obter detalhes de um objeto"""
    if object_id not in objects_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Objeto não encontrado"
        )
    
    return {
        "success": True,
        "object": objects_db[object_id]
    }

# ─── Stats Endpoint ───────────────────────────────────────────────────────────
@app.get("/api/v1/stats")
def get_stats():
    """Obter estatísticas da plataforma"""
    lost_count = sum(1 for o in objects_db.values() if o["status"] == "lost")
    found_count = sum(1 for o in objects_db.values() if o["status"] == "found")
    
    return {
        "success": True,
        "stats": {
            "total_objects": len(objects_db),
            "lost_objects": lost_count,
            "found_objects": found_count,
            "total_users": len(users_db),
            "recovery_rate": 0.66  # Placeholder
        }
    }

# ─── Error Handlers ───────────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail
        }
    )

# ─── Handler para Vercel (AWS Lambda / serverless) ───────────────────────────
handler = Mangum(app, lifespan="off")
