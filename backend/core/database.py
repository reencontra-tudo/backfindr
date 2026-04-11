from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from core.config import settings
import os

# Lazy initialization - only create engine when needed
_engine = None
_AsyncSessionLocal = None

def get_engine():
    global _engine
    if _engine is None:
        # Ensure asyncpg is used by adding the driver to the URL if not present
        database_url = settings.DATABASE_URL
        if "postgresql+asyncpg" not in database_url and "postgresql://" in database_url:
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
        
        _engine = create_async_engine(
            database_url,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
    return _engine

def get_async_session_local():
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            get_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _AsyncSessionLocal

# For backward compatibility
@property
def engine():
    return get_engine()

@property  
def AsyncSessionLocal():
    return get_async_session_local()


class Base(DeclarativeBase):
    pass


async def get_db():
    async with get_async_session_local()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
