import datetime
import uuid
from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def generate_uuid() -> str:
    return str(uuid.uuid4())


def normalize_db_url(url: str) -> str:
    # SQLAlchemy requires driver prefix mysql+pymysql:// when using PyMySQL
    if url.startswith("mysql://"):
        url = url.replace("mysql://", "mysql+pymysql://", 1)
    # TiDB / MySQL restricts user tables inside system 'sys' schema; redirect to chemical_color
    if url.rstrip("/").endswith("/sys"):
        url = url[: url.rfind("/sys")] + "/chemical_color"
    return url


def get_engine(db_url: str | None = None):
    url = normalize_db_url(db_url or settings.DATABASE_URL)
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, echo=False)


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
