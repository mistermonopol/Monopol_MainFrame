from pydantic_settings import BaseSettings
from pydantic import Field, SecretStr


class Settings(BaseSettings):
    database_url: str = "sqlite:///./life.db"
    health_database_url: str = "sqlite:///./health.db"
    public_url: str = "http://localhost:3000"
    admin_password: SecretStr = Field(min_length=16, max_length=1024)
    cookie_secure: bool = True
    ai_base_url: str = ""
    ai_model: str = ""
    ai_api_key: SecretStr = SecretStr("")
    obsidian_vault_path: str = ""
    obsidian_vault_name: str = "mono_frame_brain"


settings = Settings()
