import logging
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.services.parser import extract_text_from_file
from app.services.tts_service import generate_audio_stream, get_available_voices

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

class SynthesizeRequest(BaseModel):
    text: str = Field(..., description="Văn bản cần chuyển đổi thành giọng nói")
    voice: str = Field(default="vi-VN-HoaiMyNeural", description="ID giọng đọc (ví dụ: vi-VN-HoaiMyNeural)")
    rate: str = Field(default="+0%", description="Tốc độ đọc (ví dụ: +10%, -20%)")
    pitch: str = Field(default="+0Hz", description="Cao độ giọng đọc (ví dụ: +5Hz, -5Hz)")
    volume: str = Field(default="+0%", description="Âm lượng (ví dụ: +0%, +20%)")

    @field_validator("text")
    @classmethod
    def validate_non_empty_text(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Văn bản không được để trống hoặc chỉ chứa khoảng trắng.")
        return stripped


@router.get("/health", summary="Kiểm tra trạng thái dịch vụ")
async def health_check():
    return {
        "status": "ok",
        "app": settings.app_name
    }



@router.get("/voices", summary="Lấy danh sách các giọng đọc hỗ trợ")
async def list_voices(locale: str | None = None):
    """
    Trả về danh sách giọng đọc từ Edge-TTS, ưu tiên giọng đọc tiếng Việt lên đầu.
    """
    try:
        voices = await get_available_voices(locale_filter=locale)
        return voices
    except Exception as e:
        logger.error(f"Lỗi khi lấy danh sách giọng đọc: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tải danh sách giọng đọc."
        )


@router.post("/upload", summary="Tải lên file văn bản (.txt, .docx, .pdf) để trích xuất chữ")
async def upload_document(file: UploadFile = File(...)):
    """
    Nhận file tài liệu, đọc và trả về văn bản sạch kèm số từ và số ký tự.
    """
    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Dung lượng file vượt quá giới hạn cho phép ({settings.max_upload_size_mb}MB)."
        )

    try:
        result = extract_text_from_file(file.filename, content)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Lỗi trích xuất file {file.filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi trong quá trình đọc nội dung file: {str(e)}"
        )


@router.post("/synthesize", summary="Chuyển văn bản thành file âm thanh MP3")
async def synthesize_speech(req: SynthesizeRequest):
    """
    Sinh luồng dữ liệu MP3 từ văn bản với các tùy chỉnh giọng đọc, tốc độ, cao độ, âm lượng.
    """
    try:
        audio_stream = generate_audio_stream(
            text=req.text,
            voice=req.voice,
            rate=req.rate,
            pitch=req.pitch,
            volume=req.volume
        )

        return StreamingResponse(
            audio_stream,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="speech.mp3"',
                "Cache-Control": "no-cache"
            }
        )
    except Exception as e:
        logger.error(f"Lỗi khi tổng hợp âm thanh: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Không thể kết nối máy chủ giọng nói Edge-TTS: {str(e)}"
        )
