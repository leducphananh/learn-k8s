import asyncio
import logging
from typing import AsyncGenerator
import edge_tts
from app.services.chunker import smart_chunk_text

logger = logging.getLogger(__name__)

# Cache danh sách voices trong bộ nhớ
_VOICES_CACHE: list[dict] | None = None

async def get_available_voices(locale_filter: str | None = None) -> list[dict]:
    """
    Lấy danh sách các giọng đọc từ Edge-TTS, ưu tiên giọng Việt Nam đưa lên đầu.
    """
    global _VOICES_CACHE
    if _VOICES_CACHE is None:
        try:
            raw_voices = await edge_tts.list_voices()
            formatted = []
            for v in raw_voices:
                short_name = v.get("ShortName", "")
                gender = v.get("Gender", "Unknown")
                locale = v.get("Locale", "")
                friendly_name = short_name.split("-")[-1].replace("Neural", "")

                formatted.append({
                    "id": short_name,
                    "name": f"{friendly_name} ({'Nữ' if gender.lower() == 'female' else 'Nam'})",
                    "gender": gender,
                    "locale": locale
                })

            # Sắp xếp: vi-VN lên trước, sau đó tới các ngôn ngữ khác
            def sort_key(item):
                loc = item["locale"]
                if loc.startswith("vi-VN"):
                    # Hoài My đứng trước Nam Minh
                    if "HoaiMy" in item["id"]:
                        return (0, 0)
                    return (0, 1)
                elif loc.startswith("en-US"):
                    return (1, loc)
                return (2, loc)

            formatted.sort(key=sort_key)
            _VOICES_CACHE = formatted
        except Exception as e:
            logger.error(f"Lỗi khi tải danh sách voices từ edge-tts: {e}")
            # Fallback danh sách cố định nếu không có mạng
            return [
                {"id": "vi-VN-HoaiMyNeural", "name": "Hoài My (Nữ)", "gender": "Female", "locale": "vi-VN"},
                {"id": "vi-VN-NamMinhNeural", "name": "Nam Minh (Nam)", "gender": "Male", "locale": "vi-VN"},
                {"id": "en-US-JennyNeural", "name": "Jenny (Nữ - US)", "gender": "Female", "locale": "en-US"},
                {"id": "en-US-GuyNeural", "name": "Guy (Nam - US)", "gender": "Male", "locale": "en-US"},
            ]

    if locale_filter:
        return [v for v in _VOICES_CACHE if locale_filter.lower() in v["locale"].lower()]
    return _VOICES_CACHE


async def generate_audio_stream(
    text: str,
    voice: str = "vi-VN-HoaiMyNeural",
    rate: str = "+0%",
    pitch: str = "+0Hz",
    volume: str = "+0%",
    max_chunk_chars: int = 1200
) -> AsyncGenerator[bytes, None]:
    """
    Sinh luồng dữ liệu âm thanh MP3 từ văn bản.
    Tự động chia đoạn nếu văn bản dài và thử lại khi có lỗi mạng.
    """
    if not text or not text.strip():
        return

    chunks = smart_chunk_text(text, max_chars=max_chunk_chars)
    if not chunks:
        return

    for chunk in chunks:
        # Cơ chế Retry 2 lần cho mỗi chunk nếu gặp sự cố mạng
        success = False
        last_error = None

        for attempt in range(2):
            try:
                communicate = edge_tts.Communicate(
                    text=chunk,
                    voice=voice,
                    rate=rate,
                    pitch=pitch,
                    volume=volume
                )
                async for message in communicate.stream():
                    if message["type"] == "audio":
                        yield message["data"]
                success = True
                break
            except Exception as e:
                last_error = e
                logger.warning(f"Lỗi khi stream chunk (thử lần {attempt + 1}/2): {e}")
                await asyncio.sleep(0.5)

        if not success:
            logger.error(f"Không thể tạo âm thanh cho đoạn: '{chunk[:40]}...': {last_error}")
            raise RuntimeError(f"Không thể kết nối máy chủ giọng nói Edge-TTS: {last_error}")
