import io
import re
import unicodedata
from pathlib import Path
import docx
from pypdf import PdfReader

SUPPORTED_EXTENSIONS = {".txt", ".docx", ".pdf"}

def extract_text_from_file(filename: str, content: bytes) -> dict:
    """
    Trích xuất văn bản sạch từ file (.txt, .docx, .pdf) cùng thống kê số từ và ký tự.
    """
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Định dạng file không được hỗ trợ: '{ext}'. Chỉ hỗ trợ .txt, .docx, .pdf")

    if not content:
        return {
            "text": "",
            "word_count": 0,
            "char_count": 0
        }

    raw_text = ""

    if ext == ".txt":
        # Kiểm tra BOM UTF-16
        if content.startswith((b"\xff\xfe", b"\xfe\xff")):
            raw_text = content.decode("utf-16", errors="replace")
        else:
            # Thử UTF-8 trước (chuẩn quốc tế và tiếng Việt hiện đại)
            try:
                raw_text = content.decode("utf-8")
            except UnicodeDecodeError:
                # Nếu không phải UTF-8, thử Windows-1258 (tiếng Việt cũ)
                try:
                    raw_text = content.decode("windows-1258")
                except UnicodeDecodeError:
                    raw_text = content.decode("utf-8", errors="replace")

    elif ext == ".docx":
        doc = docx.Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        raw_text = "\n\n".join(paragraphs)

    elif ext == ".pdf":
        reader = PdfReader(io.BytesIO(content))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text()
            if t and t.strip():
                pages_text.append(t.strip())
        raw_text = "\n\n".join(pages_text)

    # Chuẩn hóa Unicode về dạng NFC (chuẩn tiếng Việt có dấu dựng sẵn)
    clean_text = unicodedata.normalize("NFC", raw_text).strip()
    words = [w for w in re.split(r"\s+", clean_text) if w]
    word_count = len(words)
    char_count = len(clean_text)

    return {
        "text": clean_text,
        "word_count": word_count,
        "char_count": char_count
    }
