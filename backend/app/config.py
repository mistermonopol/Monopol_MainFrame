from pydantic_settings import BaseSettings
from pydantic import Field, SecretStr


class Settings(BaseSettings):
    database_url: str = "sqlite:///./life.db"
    health_database_url: str = "sqlite:///./health.db"
    public_url: str = "http://localhost:3000"
    admin_password: SecretStr = Field(min_length=16, max_length=1024)
    cookie_secure: bool = True


settings = Settings()
