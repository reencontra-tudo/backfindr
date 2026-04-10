"""
routers/matching.py
Motor de matching por IA — cruza objetos perdidos com achados.

Algoritmo:
  1. Filtra objetos compatíveis (categoria + localização próxima)
  2. Calcula score de similaridade por texto (TF-IDF simplificado)
  3. Bonus por mesma categoria, proximidade geográfica e tempo
  4. Persiste matches com score >= threshold
  5. Notifica donos dos matches encontrados

Em produção: substituir o algoritmo de texto por embeddings
(ex: OpenAI text-embedding-3-small ou sentence-transformers local).
"""
import uuid
import math
import re
from typing import List, Tuple
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from core.database import get_db, AsyncSessionLocal
from core.deps import get_current_user
from models import User, RegisteredObject, Match, Notification
from routers.notifications import send_push_to_user

router = APIRouter(prefix="/matching", tags=["matching"])

# ─── Config ───────────────────────────────────────────────────────────────────
MATCH_THRESHOLD = 0.45       # Score mínimo para criar um match
MAX_DISTANCE_KM = 50.0       # Raio máximo de busca
MAX_DAYS_LOOKBACK = 90       # Busca objetos dos últimos 90 dias


# ─── Geo helpers ──────────────────────────────────────────────────────────────
def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def distance_score(lat1, lng1, lat2, lng2) -> float:
    """1.0 se mesmo local, 0.0 se > MAX_DISTANCE_KM"""
    if not all([lat1, lng1, lat2, lng2]):
        return 0.3  # Sem localização — score neutro
    dist = haversine_km(lat1, lng1, lat2, lng2)
    if dist > MAX_DISTANCE_KM:
        return 0.0
    return max(0.0, 1.0 - (dist / MAX_DISTANCE_KM))


# ─── Text similarity ──────────────────────────────────────────────────────────
def tokenize(text: str) -> List[str]:
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    stopwords = {'o','a','os','as','um','uma','de','da','do','em','no','na','e','é','para','com','por','que','se','ao','à'}
    return [w for w in text.split() if w not in stopwords and len(w) > 2]


def jaccard_similarity(text1: str, text2: str) -> float:
    set1 = set(tokenize(text1))
    set2 = set(tokenize(text2))
    if not set1 or not set2:
        return 0.0
    intersection = set1 & set2
    union = set1 | set2
    return len(intersection) / len(union)


def text_score(obj_lost: RegisteredObject, obj_found: RegisteredObject) -> float:
    title_sim = jaccard_similarity(obj_lost.title, obj_found.title)
    desc_sim = jaccard_similarity(obj_lost.description, obj_found.description)

    # Bonus por palavras-chave específicas (cor, marca, modelo)
    keywords_lost = set(tokenize(f"{obj_lost.title} {obj_lost.description}"))
    keywords_found = set(tokenize(f"{obj_found.title} {obj_found.description}"))
    common = keywords_lost & keywords_found
    keyword_bonus = min(0.2, len(common) * 0.04)

    return (title_sim * 0.5) + (desc_sim * 0.35) + keyword_bonus


def category_score(obj_lost: RegisteredObject, obj_found: RegisteredObject) -> float:
    if obj_lost.category == obj_found.category:
        return 1.0
    # Categorias relacionadas
    related = [
        {'electronics', 'phone'},
        {'bag', 'wallet'},
        {'document', 'wallet'},
    ]
    for group in related:
        if obj_lost.category in group and obj_found.category in group:
            return 0.6
    return 0.0


def pet_score(obj_lost: RegisteredObject, obj_found: RegisteredObject) -> float:
    if obj_lost.category != 'pet' or obj_found.category != 'pet':
        return 0.0
    score = 0.0
    if obj_lost.pet_species and obj_found.pet_species:
        score += 0.4 if obj_lost.pet_species == obj_found.pet_species else -0.2
    if obj_lost.pet_breed and obj_found.pet_breed:
        if obj_lost.pet_breed.lower() in obj_found.pet_breed.lower() or obj_found.pet_breed.lower() in obj_lost.pet_breed.lower():
            score += 0.3
    if obj_lost.pet_color and obj_found.pet_color:
        colors_lost = set(obj_lost.pet_color.lower().split())
        colors_found = set(obj_found.pet_color.lower().split())
        if colors_lost & colors_found:
            score += 0.3
    if obj_lost.pet_microchip and obj_found.pet_microchip:
        if obj_lost.pet_microchip == obj_found.pet_microchip:
            score = 1.0  # Microchip idêntico = match perfeito
    return min(1.0, max(0.0, score))


def compute_score(obj_lost: RegisteredObject, obj_found: RegisteredObject) -> float:
    """Score final de 0.0 a 1.0"""
    cat = category_score(obj_lost, obj_found)
    if cat == 0.0:
        return 0.0  # Categoria incompatível — descarta

    txt = text_score(obj_lost, obj_found)
    geo = distance_score(
        obj_lost.location_lat, obj_lost.location_lng,
        obj_found.location_lat, obj_found.location_lng
    )

    if obj_lost.category == 'pet':
        pet = pet_score(obj_lost, obj_found)
        score = (cat * 0.1) + (txt * 0.25) + (geo * 0.25) + (pet * 0.4)
    else:
        score = (cat * 0.15) + (txt * 0.55) + (geo * 0.30)

    return round(min(1.0, max(0.0, score)), 3)


# ─── Core matching function ────────────────────────────────────────────────────
async def run_matching_for_object(object_id: str, db: AsyncSession) -> List[Match]:
    """Roda o matching para um objeto específico e persiste os resultados."""
    result = await db.execute(select(RegisteredObject).where(RegisteredObject.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        return []

    # Determina o status oposto a buscar
    target_status = 'found' if obj.status == 'lost' else 'lost'
    cutoff = datetime.utcnow() - timedelta(days=MAX_DAYS_LOOKBACK)

    # Busca candidatos
    candidates_result = await db.execute(
        select(RegisteredObject).where(
            and_(
                RegisteredObject.status == target_status,
                RegisteredObject.id != obj.id,
                RegisteredObject.owner_id != obj.owner_id,
                RegisteredObject.created_at >= cutoff,
            )
        )
    )
    candidates = candidates_result.scalars().all()

    new_matches = []
    for candidate in candidates:
        score = compute_score(obj, candidate)
        if score < MATCH_THRESHOLD:
            continue

        # Verifica se match já existe
        existing = await db.execute(
            select(Match).where(
                or_(
                    and_(Match.object_id == str(obj.id), Match.matched_object_id == str(candidate.id)),
                    and_(Match.object_id == str(candidate.id), Match.matched_object_id == str(obj.id)),
                )
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Cria match
        match = Match(
            id=uuid.uuid4(),
            object_id=obj.id,
            matched_object_id=candidate.id,
            confidence_score=score,
            status='pending',
        )
        db.add(match)

        # Notifica donos
        notif_owner = Notification(
            id=uuid.uuid4(),
            user_id=obj.owner_id,
            type='match',
            title=f'Match encontrado! {round(score*100)}% de confiança',
            body=f'Encontramos um objeto que pode ser "{obj.title}". Confirme o match.',
            url=f'/dashboard/matches',
        )
        notif_finder = Notification(
            id=uuid.uuid4(),
            user_id=candidate.owner_id,
            type='match',
            title=f'Seu achado tem um possível dono! {round(score*100)}%',
            body=f'O objeto "{candidate.title}" pode pertencer a alguém. Veja o match.',
            url=f'/dashboard/matches',
        )
        db.add(notif_owner)
        db.add(notif_finder)
        new_matches.append(match)

    if new_matches:
        await db.commit()

    return new_matches


# ─── Background task ──────────────────────────────────────────────────────────
async def run_full_matching():
    """Roda matching completo em background — chamado periodicamente."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(RegisteredObject).where(
                RegisteredObject.status.in_(['lost', 'found'])
            ).order_by(RegisteredObject.created_at.desc()).limit(500)
        )
        objects = result.scalars().all()

        total_matches = 0
        for obj in objects:
            matches = await run_matching_for_object(str(obj.id), db)
            total_matches += len(matches)

        return total_matches


# ─── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/run/{object_id}")
async def trigger_matching(
    object_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispara matching para um objeto específico (chamado após registro)."""
    # Verificar que o objeto pertence ao usuário
    result = await db.execute(
        select(RegisteredObject).where(
            RegisteredObject.id == object_id,
            RegisteredObject.owner_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Objeto não encontrado")

    background_tasks.add_task(run_matching_for_object, object_id, db)
    return {"detail": "Matching iniciado em background"}


@router.post("/run-all")
async def trigger_full_matching(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Dispara matching completo (admin only em produção)."""
    background_tasks.add_task(run_full_matching)
    return {"detail": "Matching completo iniciado em background"}


@router.get("/scores/{object_id}")
async def get_match_scores(
    object_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna matches existentes com scores para um objeto."""
    result = await db.execute(
        select(Match).where(
            or_(
                Match.object_id == object_id,
                Match.matched_object_id == object_id,
            )
        ).order_by(Match.confidence_score.desc())
    )
    matches = result.scalars().all()
    return {
        "items": [
            {
                "id": str(m.id),
                "object_id": str(m.object_id),
                "matched_object_id": str(m.matched_object_id),
                "confidence_score": m.confidence_score,
                "confidence_pct": round(m.confidence_score * 100),
                "status": m.status,
                "created_at": m.created_at.isoformat(),
            }
            for m in matches
        ]
    }
