from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    database_url: str = "sqlite:///./life.db"
    health_database_url: str = "sqlite:///./health.db"
    public_url: str = "http://localhost:3000"
    google_client_id: str = ""
    google_client_secret: str = ""
    allowed_email: str = ""
    session_secret: str = Field(min_length=32)
    cookie_secure: bool = True


settings = Settings()
