from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Google Cloud Vision
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    
    # Confidence gate
    DEFAULT_CONFIDENCE_GATE: float = 0.90
    
    class Config:
        env_file = "../../.env.example"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
