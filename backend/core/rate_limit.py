"""
core/rate_limit.py
Rate limiting via Redis — protege endpoints sensíveis contra abuso.

Limites padrão:
  - /auth/login: 5 tentativas por minuto por IP
  - /auth/register: 3 registros por minuto por IP
  - /auth/forgot-password: 3 por hora por IP
  - API geral: 100 requests por minuto por IP
"""
import time
from functools import wraps
from fastapi import Request, HTTPException
import redis.asyncio as aioredis
from core.config import settings


# Singleton Redis client
_redis_client = None

async def get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception:
            return None
    return _redis_client


async def check_rate_limit(
    request: Request,
    key_prefix: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    """Lança HTTPException 429 se limite excedido."""
    client_ip = request.client.host if request.client else "unknown"
    key = f"rl:{key_prefix}:{client_ip}"

    redis = await get_redis()
    if not redis:
        return  # Sem Redis — não bloquear

    try:
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        results = await pipe.execute()
        current = results[0]

        if current > max_requests:
            retry_after = window_seconds
            raise HTTPException(
                status_code=429,
                detail=f"Muitas tentativas. Aguarde {retry_after} segundos.",
                headers={"Retry-After": str(retry_after)},
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Falha silenciosa — não bloquear em erro de Redis


# ─── Dependency factories ─────────────────────────────────────────────────────

def rate_limit(max_requests: int, window_seconds: int, key_prefix: str = "general"):
    """Dependência FastAPI para rate limiting."""
    async def dependency(request: Request):
        await check_rate_limit(request, key_prefix, max_requests, window_seconds)
    return dependency


# Limites pré-configurados
login_limit        = rate_limit(5,   60,   "login")         # 5/min
register_limit     = rate_limit(3,   60,   "register")      # 3/min
forgot_limit       = rate_limit(3,   3600, "forgot")        # 3/hora
scan_limit         = rate_limit(30,  60,   "scan")          # 30/min
api_limit          = rate_limit(100, 60,   "api")           # 100/min
