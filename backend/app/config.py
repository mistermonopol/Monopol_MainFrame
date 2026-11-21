from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr, field_validator
from .mfa import decode_secret


class Settings(BaseSettings):
    model_config = SettingsConfigDict(hide_input_in_errors=True)
    database_url: str = "sqlite:///./life.db"
    health_database_url: str = "sqlite:///./health.db"
    public_url: str = "http://localhost:3000"
    admin_password: SecretStr = Field(min_length=16, max_length=1024)
    admin_totp_secret: SecretStr
    cookie_secure: bool = True
    ai_base_url: str = ""
    ai_model: str = ""
    ai_api_key: SecretStr = SecretStr("")
    obsidian_vault_path: str = ""
    obsidian_vault_name: str = "mono_frame_brain"
    news_enabled: bool = False

    @field_validator('admin_totp_secret')
    @classmethod
    def valid_totp_secret(cls, value):
        decode_secret(value.get_secret_value())
        return value


settings = Settings()
