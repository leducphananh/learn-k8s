import pytest
from app.services.tts_service import get_available_voices, generate_audio_stream

@pytest.mark.asyncio
async def test_get_available_voices():
    voices = await get_available_voices()
    assert isinstance(voices, list)
    assert len(voices) > 0

    # Kiểm tra giọng Việt Nam có mặt và được ưu tiên đưa lên đầu
    vi_voices = [v for v in voices if "vi-VN" in v["locale"]]
    assert len(vi_voices) >= 2
    
    # Kiểm tra 2 giọng chuẩn: Hoài My & Nam Minh
    voice_ids = [v["id"] for v in vi_voices]
    assert any("HoaiMy" in vid for vid in voice_ids)
    assert any("NamMinh" in vid for vid in voice_ids)

    # Đảm bảo giọng đầu tiên trong danh sách là tiếng Việt
    assert "vi-VN" in voices[0]["locale"]

@pytest.mark.asyncio
async def test_generate_audio_stream_short_text():
    chunks = []
    async for audio_chunk in generate_audio_stream(
        text="Xin chào, đây là bài kiểm tra âm thanh.",
        voice="vi-VN-HoaiMyNeural",
        rate="+0%",
        pitch="+0Hz",
        volume="+0%"
    ):
        chunks.append(audio_chunk)

    total_bytes = b"".join(chunks)
    assert len(total_bytes) > 0
    # MP3 header hoặc sync word (0xFF, 0xFB/0xF3/0xF2 hoặc ID3 tag)
    assert total_bytes.startswith(b"ID3") or b"\xff\xfb" in total_bytes[:100] or len(total_bytes) > 500
