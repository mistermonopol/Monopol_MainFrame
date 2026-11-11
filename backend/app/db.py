from datetime import datetime, timezone
from sqlalchemy import create_engine, String, Integer, JSON, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .config import settings


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class HealthBase(DeclarativeBase):
    pass


class Item(Base):
    __tablename__ = "items"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SessionToken(Base):
    __tablename__ = "sessions"
    digest: Mapped[str] = mapped_column(String, primary_key=True)
    expires: Mapped[float]


class HealthDay(HealthBase):
    __tablename__ = "days"
    day: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class HealthSeries(HealthBase):
    __tablename__ = 'series'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    metric: Mapped[str] = mapped_column(String, index=True)
    day: Mapped[str] = mapped_column(String, index=True)
    source: Mapped[str] = mapped_column(String)
    data: Mapped[dict] = mapped_column(JSON)


class HealthMeta(HealthBase):
    __tablename__ = 'metadata'
    key: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)


engine = create_engine(settings.database_url, hide_parameters=True)
health_engine = create_engine(settings.health_database_url, hide_parameters=True)
Session = sessionmaker(engine)
HealthSession = sessionmaker(health_engine)
