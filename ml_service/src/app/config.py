from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    recommender_model_path: str = 'artifacts/recommender.joblib'
    host: str = '0.0.0.0'
    port: int = 8001


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
