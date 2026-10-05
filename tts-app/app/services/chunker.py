import re

def _split_into_sentences(text: str) -> list[str]:
    """
    Tách đoạn văn thành các câu dựa trên các dấu kết câu (. ! ? … : ;).
    """
    # Regex tìm dấu câu theo sau bởi khoảng trắng hoặc cuối dòng
    parts = re.split(r"(?<=[.!?…:;])\s+", text)
    return [p.strip() for p in parts if p.strip()]

def _split_large_sentence(sentence: str, max_chars: int) -> list[str]:
    """
    Nếu một câu đơn lẻ vượt quá max_chars, cố gắng tách theo dấu phẩy hoặc khoảng trắng.
    """
    if len(sentence) <= max_chars:
        return [sentence]

    # Thử tách theo dấu phẩy, gạch nối
    sub_parts = re.split(r"(?<=[,，—])\s+", sentence)
    if len(sub_parts) > 1 and all(len(p) <= max_chars for p in sub_parts):
        return [p.strip() for p in sub_parts if p.strip()]

    # Fallback: tách theo từng từ
    words = sentence.split()
    chunks = []
    current_chunk = []
    current_len = 0

    for word in words:
        if current_len + len(word) + 1 > max_chars and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = [word]
            current_len = len(word)
        else:
            current_chunk.append(word)
            current_len += len(word) + 1

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks

def smart_chunk_text(text: str, max_chars: int = 1200) -> list[str]:
    """
    Phân đoạn văn bản thành các khối nhỏ tối ưu (<= max_chars) cho TTS:
    - Bảo toàn trọn vẹn ngữ nghĩa câu và ngữ điệu tự nhiên.
    - Không cắt vụn từ hay bỏ sót nội dung.
    - Loại bỏ khoảng trắng thừa.
    """
    if not text or not text.strip():
        return []

    text = text.strip()
    if len(text) <= max_chars:
        return [text]

    # Bước 1: Tách theo đoạn văn (\n+)
    paragraphs = [p.strip() for p in re.split(r"\n+", text) if p.strip()]

    all_units = []
    for para in paragraphs:
        sentences = _split_into_sentences(para)
        for s in sentences:
            if len(s) > max_chars:
                all_units.extend(_split_large_sentence(s, max_chars))
            else:
                all_units.append(s)

    # Bước 2: Gom các câu/đơn vị lại thành các chunk tối ưu
    chunks = []
    current_chunk = []
    current_len = 0

    for unit in all_units:
        unit_len = len(unit)
        # Độ dài khi thêm unit này vào chunk hiện tại (cộng 1 khoảng trắng)
        added_len = unit_len + (1 if current_chunk else 0)

        if current_chunk and (current_len + added_len > max_chars):
            chunks.append(" ".join(current_chunk))
            current_chunk = [unit]
            current_len = unit_len
        else:
            current_chunk.append(unit)
            current_len += added_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks
