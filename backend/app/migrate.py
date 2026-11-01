"""Idempotent initial schema migration; run before starting the API."""
from .db import Base, HealthBase, engine, health_engine


def migrate():
    Base.metadata.create_all(engine)
    HealthBase.metadata.create_all(health_engine)


if __name__ == "__main__":
    migrate()
