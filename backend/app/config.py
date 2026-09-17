from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    jwt_secret: str

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    gbif_api_url: str = "https://api.gbif.org/v1"
    nasa_power_api_url: str = "https://power.larc.nasa.gov/api/temporal/monthly/point"
    external_api_timeout_seconds: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
