import pytest
from app.services.chunker import smart_chunk_text

def test_chunker_empty_or_whitespace():
    assert smart_chunk_text("") == []
    assert smart_chunk_text("   \n\t  ") == []

def test_chunker_short_text():
    text = "Hôm nay trời rất đẹp. Tôi đang làm một dự án TTS tiếng Việt tuyệt vời."
    chunks = smart_chunk_text(text, max_chars=500)
    assert len(chunks) == 1
    assert chunks[0] == text

def test_chunker_long_text_splits_at_sentence():
    sentences = [
        f"Câu số {i}: Đây là một câu hoàn chỉnh dùng để kiểm tra tính năng chia đoạn văn bản thông minh của hệ thống."
        for i in range(1, 25)
    ]
    full_text = " ".join(sentences)
    chunks = smart_chunk_text(full_text, max_chars=400)
    
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 450
        assert chunk.strip() != ""
        # Đảm bảo không bị cắt cụt giữa chừng
        assert chunk[-1] in ".!?:;" or len(chunk) < 400

def test_chunker_preserves_all_words():
    text = "Đoạn một có câu một. Câu hai của đoạn một!\n\nĐoạn hai có câu ba? Câu bốn kết thúc."
    chunks = smart_chunk_text(text, max_chars=50)
    # Ghép lại phải chứa đầy đủ các câu
    combined = " ".join(chunks)
    assert "Đoạn một có câu một" in combined
    assert "Câu hai của đoạn một" in combined
    assert "Đoạn hai có câu ba" in combined
    assert "Câu bốn kết thúc" in combined

def test_chunker_handles_complex_punctuation():
    text = "Thật tuyệt vời!... Bạn có nghĩ vậy không?! Vâng, tôi đồng ý. Hãy tiếp tục nào..."
    chunks = smart_chunk_text(text, max_chars=60)
    assert len(chunks) >= 2
    for c in chunks:
        assert c.strip() != ""
