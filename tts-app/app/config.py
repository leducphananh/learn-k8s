import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "EchoTTS Studio"
    port: int = int(os.getenv("PORT", 8000))
    max_upload_size_mb: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", 10))
    default_voice: str = os.getenv("DEFAULT_VOICE", "vi-VN-HoaiMyNeural")

settings = Settings()
