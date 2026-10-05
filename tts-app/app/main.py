from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    description="Studio Web & API chuyển văn bản thành giọng nói tiếng Việt chất lượng cao",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router)

# Mount Static Files and Root Route
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=FileResponse, summary="Giao diện chính EchoTTS Studio")
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    return FileResponse(index_file)
