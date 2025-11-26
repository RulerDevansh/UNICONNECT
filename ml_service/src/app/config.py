from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / '.env'),
        extra='ignore',
        populate_by_name=True,
    )

    recommender_model_path: str = Field(
        default='artifacts/recommender.joblib',
        alias='RECOMMENDER_MODEL_PATH',
    )
    recommender_data_path: str = Field(
        default='data/sample_listings.csv',
        alias='RECOMMENDER_DATA_PATH',
    )
    alcohol_model_path: str = Field(
        default='src/AlchoholDetector.h5',
        alias='ALCOHOL_MODEL_PATH',
    )
    alcohol_threshold: float = Field(
        default=0.6,
        alias='ALCOHOL_THRESHOLD',
    )
    host: str = Field(default='0.0.0.0', alias='ML_SERVICE_HOST')
    port: int = Field(default=8001, alias='ML_SERVICE_PORT')

    @field_validator('recommender_model_path', 'recommender_data_path', 'alcohol_model_path', mode='before')
    @classmethod
    def make_absolute(cls, value: str | Path) -> str:
        path = Path(value)
        if path.is_absolute():
            return str(path)
        return str((BASE_DIR / path).resolve())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
