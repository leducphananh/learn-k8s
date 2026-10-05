# Kế Hoạch Triển Khai EchoTTS Studio (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng ứng dụng Web & API Text-to-Speech (EchoTTS Studio) hoàn chỉnh bằng Python FastAPI và Microsoft Edge-TTS, hỗ trợ trích xuất file (.txt, .docx, .pdf), thuật toán phân đoạn thông minh cho văn bản dài, giao diện Dark Glassmorphism Studio kèm trình phát audio cao cấp, và bộ đóng gói Docker/K8s.

**Architecture:** Monolithic FastAPI Service phục vụ đồng thời các REST API xử lý âm thanh/tài liệu và giao diện Web UI tĩnh (HTML5/CSS3/Vanilla JS). Sử dụng `edge-tts` async streaming để tổng hợp giọng nói không cần API key hay GPU; các module parser chuyên dụng (`pypdf`, `python-docx`) để trích xuất nội dung file.

**Tech Stack:** Python 3.11, FastAPI, Uvicorn, edge-tts, pypdf, python-docx, pytest, pytest-asyncio, httpx, HTML5, Vanilla CSS (Glassmorphism), Vanilla JS (Web Audio API), Docker, Docker Compose, Kubernetes.

**Spec:** [docs/superpowers/specs/2026-10-05-tts-app-design.md](file:///Users/phananh/Documents/workspace/PhanAnh/self/learn-k8s/docs/superpowers/specs/2026-10-05-tts-app-design.md)

---

## Global Constraints

- Toàn bộ code dự án nằm gọn trong thư mục `tts-app/`.
- Python runtime: >= 3.11.
- Không yêu cầu API Key bên ngoài; toàn bộ giọng đọc xử lý qua `edge-tts`.
- Frontend thuần HTML5/CSS/JS (không dùng Node/NPM build tools, không thư viện ngoài cồng kềnh).
- Giới hạn kích thước file upload: Tối đa 10MB.
- Tất cả các endpoint API đều có validation chặt chẽ và xử lý ngoại lệ trả về JSON rõ ràng.

---

## Review Focus

1. **Văn bản rỗng hoặc chỉ toàn khoảng trắng:** Kiểm tra cả Frontend (vô hiệu hóa nút bấm) và Backend (trả về HTTP 422).
2. **File upload sai định dạng (.exe, .png) hoặc file bị hỏng:** Backend trả HTTP 400 kèm thông báo tiếng Việt, không làm crash server.
3. **Văn bản tiếng Việt dài với nhiều ký tự đặc biệt / dấu ngắt câu liên tiếp:** Thuật toán Chunker không làm mất từ, không tạo chunk rỗng, giữ nguyên ngữ điệu tự nhiên.
4. **Mất kết nối mạng hoặc Edge-TTS quá tải:** Retry 2 lần với backoff; nếu vẫn lỗi trả HTTP 503 với thông báo rõ ràng, không treo kết nối của client.
5. **Ghép luồng MP3 từ nhiều chunk:** Đảm bảo các khung MP3 ghép nối mượt mà, phát liên tục trên trình duyệt không bị giật hay méo tiếng.

---

## Danh Sách Các Nhiệm Vụ (Task Breakdown)

### Task 1: Khởi Tạo Dự Án & Cấu Hình Cơ Bản (Scaffolding & Health API)

**Files:**
- Create: `tts-app/requirements.txt`
- Create: `tts-app/app/__init__.py`
- Create: `tts-app/app/config.py`
- Create: `tts-app/app/main.py`
- Create: `tts-app/tests/__init__.py`
- Test: `tts-app/tests/test_health.py`

**Interfaces:**
- Produces: `app.main:app` (FastAPI instance), `app.config:Settings`
- Healthcheck endpoint: `GET /api/health` -> `{"status": "ok", "app": "EchoTTS Studio"}`

- [ ] **Step 1: Viết test kiểm tra endpoint /api/health**

```python
# tts-app/tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "EchoTTS Studio"}
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `pytest tts-app/tests/test_health.py -v`
Expected: FAIL (chưa có module `app.main`)

- [ ] **Step 3: Cài đặt dependencies, cấu hình config và endpoint health**

Tạo `tts-app/requirements.txt` với `fastapi`, `uvicorn`, `edge-tts`, `pypdf`, `python-docx`, `pytest`, `pytest-asyncio`, `httpx`, `python-multipart`.
Tạo `tts-app/app/config.py` quản lý biến môi trường (`PORT`, `MAX_UPLOAD_SIZE_MB`).
Tạo `tts-app/app/main.py` khởi tạo FastAPI app, cấu hình CORS và route `/api/health`.

- [ ] **Step 4: Chạy test để xác nhận test thành công**

Run: `pytest tts-app/tests/test_health.py -v`
Expected: PASS

- [ ] **Step 5: Commit mã nguồn Task 1**

```bash
git add tts-app/
git commit -m "feat(tts): initialize project structure and health endpoint"
```

---

### Task 2: Module Trích Xuất File Tài Liệu (Document Parser)

**Files:**
- Create: `tts-app/app/services/__init__.py`
- Create: `tts-app/app/services/parser.py`
- Test: `tts-app/tests/test_parser.py`

**Interfaces:**
- Produces: `extract_text_from_file(filename: str, content: bytes) -> dict`
- Trả về cấu trúc: `{"text": str, "word_count": int, "char_count": int}`

- [ ] **Step 1: Viết test trích xuất file (.txt, .docx, .pdf)**

```python
# tts-app/tests/test_parser.py
import pytest
from app.services.parser import extract_text_from_file

def test_parse_txt_utf8():
    content = "Xin chào Việt Nam! Đây là văn bản thử nghiệm.".encode("utf-8")
    result = extract_text_from_file("sample.txt", content)
    assert "Xin chào Việt Nam!" in result["text"]
    assert result["word_count"] > 0
    assert result["char_count"] > 0

def test_parse_invalid_extension():
    with pytest.raises(ValueError, match="Định dạng file không được hỗ trợ"):
        extract_text_from_file("image.png", b"fake binary data")
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `pytest tts-app/tests/test_parser.py -v`
Expected: FAIL (chưa có module `app.services.parser`)

- [ ] **Step 3: Cài đặt logic parser trong `tts-app/app/services/parser.py`**

Triển khai hàm `extract_text_from_file`:
- Xử lý `.txt`: Thử decode lần lượt theo UTF-8, UTF-16, CP1258.
- Xử lý `.docx`: Dùng `docx.Document(io.BytesIO(content))` duyệt từng paragraph.
- Xử lý `.pdf`: Dùng `pypdf.PdfReader(io.BytesIO(content))` trích xuất text từng trang.
- Tính toán `word_count` và `char_count` sau khi chuẩn hóa khoảng trắng thừa.

- [ ] **Step 4: Chạy lại toàn bộ test parser**

Run: `pytest tts-app/tests/test_parser.py -v`
Expected: PASS

- [ ] **Step 5: Commit mã nguồn Task 2**

```bash
git add tts-app/app/services/parser.py tts-app/tests/test_parser.py
git commit -m "feat(tts): implement document parser for txt, docx and pdf"
```

---

### Task 3: Thuật Toán Phân Đoạn Văn Bản Thông Minh (Smart Auto-Chunker)

**Files:**
- Create: `tts-app/app/services/chunker.py`
- Test: `tts-app/tests/test_chunker.py`

**Interfaces:**
- Produces: `smart_chunk_text(text: str, max_chars: int = 1200) -> list[str]`
- Chia đoạn văn bản lớn thành danh sách các chuỗi con liền mạch, không cắt ngang câu.

- [ ] **Step 1: Viết test cho thuật toán chunker**

```python
# tts-app/tests/test_chunker.py
from app.services.chunker import smart_chunk_text

def test_chunker_short_text():
    text = "Hôm nay trời rất đẹp. Tôi đang làm một dự án TTS."
    chunks = smart_chunk_text(text, max_chars=500)
    assert len(chunks) == 1
    assert chunks[0] == text

def test_chunker_long_text_splits_at_sentence():
    p1 = "Đoạn văn thứ nhất có nội dung khá dài. " * 20
    p2 = "Đoạn văn thứ hai cũng có nội dung tiếp nối. " * 20
    full_text = f"{p1}\n\n{p2}"
    chunks = smart_chunk_text(full_text, max_chars=600)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 650
        assert chunk.strip() != ""
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `pytest tts-app/tests/test_chunker.py -v`
Expected: FAIL (chưa có module `app.services.chunker`)

- [ ] **Step 3: Triển khai thuật toán trong `tts-app/app/services/chunker.py`**

Triển khai tách đoạn theo `\n\n` -> dấu câu kết thúc (`.`, `!`, `?`, `…`) -> gom lại thành các chunk có độ dài <= `max_chars`. Đảm bảo loại bỏ các chuỗi rỗng và strip whitespace.

- [ ] **Step 4: Chạy test để xác nhận test vượt qua**

Run: `pytest tts-app/tests/test_chunker.py -v`
Expected: PASS

- [ ] **Step 5: Commit mã nguồn Task 3**

```bash
git add tts-app/app/services/chunker.py tts-app/tests/test_chunker.py
git commit -m "feat(tts): implement smart text chunking algorithm"
```

---

### Task 4: Dịch Vụ Tổng Hợp Âm Thanh (Edge-TTS Service Wrapper)

**Files:**
- Create: `tts-app/app/services/tts_service.py`
- Test: `tts-app/tests/test_tts_service.py`

**Interfaces:**
- Produces:
  - `get_available_voices(locale_filter: str | None = None) -> list[dict]`
  - `generate_audio_stream(text: str, voice: str, rate: str, pitch: str, volume: str) -> AsyncGenerator[bytes, None]`

- [ ] **Step 1: Viết test lấy danh sách giọng đọc và kiểm tra giọng tiếng Việt**

```python
# tts-app/tests/test_tts_service.py
import pytest
from app.services.tts_service import get_available_voices

@pytest.mark.asyncio
async def test_get_voices():
    voices = await get_available_voices()
    assert len(voices) > 0
    # Đảm bảo có giọng Việt Nam
    vi_voices = [v for v in voices if "vi-VN" in v["locale"]]
    assert len(vi_voices) >= 2
    # Kiểm tra giọng Hoài My và Nam Minh
    voice_ids = [v["id"] for v in vi_voices]
    assert any("HoaiMy" in vid for vid in voice_ids)
    assert any("NamMinh" in vid for vid in voice_ids)
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `pytest tts-app/tests/test_tts_service.py -v`
Expected: FAIL (chưa có module `app.services.tts_service`)

- [ ] **Step 3: Triển khai Edge-TTS service trong `tts-app/app/services/tts_service.py`**

- Hàm `get_available_voices()`: Gọi `edge_tts.list_voices()`, sắp xếp đưa giọng `vi-VN` lên đầu, cache kết quả trong bộ nhớ.
- Hàm `generate_audio_stream()`:
  - Sử dụng `smart_chunk_text` nếu văn bản dài.
  - Gọi `edge_tts.Communicate(chunk, voice, rate=rate, pitch=pitch, volume=volume).stream()`.
  - Lọc lấy các audio chunks (`chunk["type"] == "audio"`) và yield bytes ra ngoài.

- [ ] **Step 4: Chạy test để xác nhận test thành công**

Run: `pytest tts-app/tests/test_tts_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit mã nguồn Task 4**

```bash
git add tts-app/app/services/tts_service.py tts-app/tests/test_tts_service.py
git commit -m "feat(tts): integrate edge-tts service with async streaming and voice listing"
```

---

### Task 5: Xây Dựng REST API Endpoints

**Files:**
- Create: `tts-app/app/api/routes.py`
- Modify: `tts-app/app/main.py` (Include router)
- Test: `tts-app/tests/test_api.py`

**Interfaces:**
- Endpoints:
  - `GET /api/voices`: Lấy danh sách giọng đọc.
  - `POST /api/upload`: Upload file `.txt`, `.docx`, `.pdf` -> JSON text.
  - `POST /api/synthesize`: Nhận request synthesize -> Stream `audio/mpeg`.

- [ ] **Step 1: Viết test cho các API endpoints**

```python
# tts-app/tests/test_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_voices():
    response = client.get("/api/voices")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_api_upload_txt():
    files = {"file": ("test.txt", b"Noi dung text kiem tra", "text/plain")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["text"] == "Noi dung text kiem tra"
    assert res_data["word_count"] == 5

def test_api_synthesize_empty_text():
    response = client.post("/api/synthesize", json={"text": "   ", "voice": "vi-VN-HoaiMyNeural"})
    assert response.status_code == 422
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `pytest tts-app/tests/test_api.py -v`
Expected: FAIL (chưa có router và các endpoints)

- [ ] **Step 3: Cài đặt router trong `tts-app/app/api/routes.py` và gắn vào `main.py`**

- Định nghĩa Pydantic model `SynthesizeRequest`:
  - `text: str = Field(..., min_length=1)`
  - `voice: str = "vi-VN-HoaiMyNeural"`
  - `rate: str = "+0%"`
  - `pitch: str = "+0Hz"`
  - `volume: str = "+0%"`
- Endpoint `/api/voices`: Trả về danh sách giọng đọc.
- Endpoint `/api/upload`: Nhận file upload, kiểm tra dung lượng (< 10MB) và gọi parser.
- Endpoint `/api/synthesize`: Trả về `StreamingResponse(generate_audio_stream(...), media_type="audio/mpeg")`.

- [ ] **Step 4: Chạy test để xác nhận tất cả API test đều PASS**

Run: `pytest tts-app/tests/test_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit mã nguồn Task 5**

```bash
git add tts-app/app/api/routes.py tts-app/app/main.py tts-app/tests/test_api.py
git commit -m "feat(tts): implement REST API endpoints for voices, upload and synthesis"
```

---

### Task 6: Phát Triển Giao Diện Web Studio & Trình Phát Audio

**Files:**
- Create: `tts-app/app/static/index.html`
- Create: `tts-app/app/static/css/style.css`
- Create: `tts-app/app/static/js/app.js`
- Create: `tts-app/app/static/js/player.js`
- Modify: `tts-app/app/main.py` (Mount static files và route `/`)

**Tính năng UI:**
- **Layout & Visuals:** Giao diện tối Dark Glassmorphism, font chữ Google Fonts (Inter / Outfit), responsive trên mọi kích thước màn hình.
- **Input Tabs:** Tab Nhập văn bản & Tab Kéo thả file tài liệu; đếm ký tự & từ tức thời; các nút văn bản mẫu (Tin tức, Kể chuyện).
- **Voice & Parameter Controls:** Dropdown chọn giọng với cờ quốc gia; các thanh trượt Speed, Pitch, Volume với nút Reset; phím tắt `Ctrl + Enter`.
- **Audio Player Bar:** Trình phát nhạc thanh lịch với sóng âm (Waveform visualizer), timeline scrubber, thời lượng phát, nút Tải file MP3.
- **Session History:** Khay lưu lại 5 bản audio vừa tạo trong phiên để nghe lại và tải lại.

- [ ] **Step 1: Xây dựng cấu trúc HTML Semantic (`index.html`)**
- [ ] **Step 2: Viết hệ thống CSS Tokens & Hiệu ứng Glassmorphism (`style.css`)**
- [ ] **Step 3: Viết logic điều khiển audio player và visualizer (`player.js`)**
- [ ] **Step 4: Viết tương tác giao diện, upload file, gọi API và quản lý lịch sử (`app.js`)**
- [ ] **Step 5: Cấu hình FastAPI mount thư mục `static/` và kiểm tra giao diện trên trình duyệt**
- [ ] **Step 6: Commit mã nguồn Task 6**

```bash
git add tts-app/app/static/ tts-app/app/main.py
git commit -m "feat(tts): implement modern dark glassmorphism web studio and audio player"
```

---

### Task 7: Đóng Gói Docker, Docker Compose & Kubernetes Manifests

**Files:**
- Create: `tts-app/Dockerfile`
- Create: `tts-app/docker-compose.yml`
- Create: `tts-app/k8s/deployment.yaml`
- Create: `tts-app/k8s/service.yaml`
- Create: `tts-app/README.md`

- [ ] **Step 1: Viết `Dockerfile` tối ưu dựa trên `python:3.11-slim` với non-root user và healthcheck**
- [ ] **Step 2: Viết `docker-compose.yml` để chạy ứng dụng local chỉ với một lệnh `docker compose up`**
- [ ] **Step 3: Viết manifest K8s (`deployment.yaml` và `service.yaml`) có cấu hình resource limit và liveness/readiness probe**
- [ ] **Step 4: Viết `README.md` hướng dẫn chi tiết cách chạy bằng Python trực tiếp, qua Docker, và triển khai lên K8s**
- [ ] **Step 5: Kiểm thử build Docker image và xác thực container hoạt động ổn định**
- [ ] **Step 6: Commit mã nguồn Task 7**

```bash
git add tts-app/Dockerfile tts-app/docker-compose.yml tts-app/k8s/ tts-app/README.md
git commit -m "feat(tts): add Dockerfile, docker-compose and Kubernetes deployment manifests"
```
