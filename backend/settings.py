import os
from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

# Load .env file from the backend directory
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

class Settings(BaseSettings):
    jwt_secret: str = Field(..., validation_alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 8
    allowed_origins_raw: str = Field(default="http://localhost:5173", validation_alias="ALLOWED_ORIGINS")

    @property
    def allowed_origins(self) -> list[str]:
        v = self.allowed_origins_raw
        if v.startswith("[") and v.endswith("]"):
            import json
            try:
                return json.loads(v)
            except Exception:
                pass
        return [origin.strip() for origin in v.split(",") if origin.strip()]

settings = Settings()
