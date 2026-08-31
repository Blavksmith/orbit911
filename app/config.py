from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Orbit911"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./orbit911.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
