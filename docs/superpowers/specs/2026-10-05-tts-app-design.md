# Đặc Tả Thiết Kế Hệ Thống Chuyển Văn Bản Thành Giọng Nói (EchoTTS Studio)

- **Ngày tạo:** 2026-10-05
- **Trạng thái:** Đã duyệt hoàn chỉnh (Ready for Implementation Plan)
- **Mục tiêu:** Xây dựng ứng dụng Web & API chuyển văn bản thành giọng nói tiếng Việt chất lượng cao, miễn phí, hỗ trợ xử lý tài liệu và văn bản dài, sẵn sàng đóng gói Docker và triển khai Kubernetes.

---

## 1. Mục Tiêu & Công Nghệ Cốt Lõi

- **Engine TTS:** Microsoft `edge-tts` (miễn phí, không cần API Key, không cần GPU, hỗ trợ giọng tự nhiên `vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural` và hơn 100+ giọng quốc tế).
- **Backend:** Python 3.11 + FastAPI + Uvicorn (xử lý bất đồng bộ non-blocking, streaming audio mượt mà).
- **Trích xuất tài liệu:** `pypdf` (xử lý PDF), `python-docx` (xử lý Word .docx), `codecs` (xử lý .txt đa bảng mã).
- **Frontend:** HTML5 Semantic + Modern CSS (Dark Glassmorphism Studio, Responsive) + Vanilla JS (nhẹ, nhanh, không phụ thuộc Node/NPM).
- **Đóng gói:** Dockerfile (`python:3.11-slim`), `docker-compose.yml`, K8s manifests (`deployment.yaml`, `service.yaml`).

---

## 2. Phần 1: Kiến Trúc & Cấu Trúc Thư Mục

Dự án được đặt trọn vẹn trong thư mục `tts-app/`:

```text
tts-app/
├── app/
│   ├── __init__.py
│   ├── main.py              # Khởi tạo FastAPI app, cấu hình CORS, static mount
│   ├── config.py            # Quản lý cấu hình (port, cache, max upload size)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # Các API endpoints: /health, /voices, /synthesize, /upload
│   ├── services/
│   │   ├── __init__.py
│   │   ├── tts_service.py   # Wrapper gọi edge-tts, tùy chỉnh voice/rate/pitch/volume
│   │   ├── chunker.py       # Thuật toán tách đoạn thông minh (smart auto-chunking)
│   │   └── parser.py        # Trích xuất văn bản từ .txt, .docx, .pdf
│   └── static/
│       ├── index.html       # Giao diện chính Studio
│       ├── css/
│       │   └── style.css    # CSS Glassmorphism tối sang trọng, responsive
│       └── js/
│           ├── app.js       # Tương tác giao diện, upload file, gọi API
│           └── player.js    # Trình phát audio tùy biến (sóng âm visualizer, timeline)
├── tests/
│   ├── test_chunker.py      # Unit test thuật toán chia đoạn
│   ├── test_parser.py       # Unit test đọc các định dạng file
│   └── test_api.py          # Integration test API endpoints
├── k8s/
│   ├── deployment.yaml      # Kubernetes Deployment manifest (probes, resources)
│   └── service.yaml         # Kubernetes Service manifest
├── Dockerfile               # Đóng gói image nhẹ (~180MB)
├── docker-compose.yml       # Khởi chạy một lệnh duy nhất
├── requirements.txt         # Danh sách dependencies
├── DESIGN.md                # Tài liệu thiết kế hệ thống
└── README.md                # Hướng dẫn sử dụng & API doc
```

---

## 3. Phần 2: Đặc Tả REST API & Luồng Xử Lý Dữ Liệu

### 3.1. Danh sách Endpoints
- `GET /api/health`: Trả về `{"status": "ok"}` phục vụ Health check & K8s probes.
- `GET /api/voices`: Trả về danh sách giọng đọc có sẵn, ưu tiên giọng Việt Nam (có cache trong bộ nhớ).
- `POST /api/upload`: Nhận file upload (`multipart/form-data`) $\to$ Trả về `{"text": "...", "word_count": 120, "char_count": 850}`.
- `POST /api/synthesize`: Chuyển đổi văn bản thành âm thanh:
  ```json
  {
    "text": "Nội dung cần chuyển đổi...",
    "voice": "vi-VN-HoaiMyNeural",
    "rate": "+0%",
    "pitch": "+0Hz",
    "volume": "+0%"
  }
  ```
  Response: Stream trực tiếp `audio/mpeg` (Content-Disposition: `inline; filename="speech.mp3"`).

### 3.2. Thuật toán Smart Auto-Chunking (`services/chunker.py`)
- Tách theo ngắt đoạn (`\n\n`, `\n`).
- Tách theo dấu kết thúc câu (`.`, `!`, `?`, `…`).
- Gom các câu thành các khối tối ưu (800 - 1500 ký tự) để giữ ngữ điệu tự nhiên.
- Ghép nối các audio stream/chunks tuần tự không để vỡ tiếng.

### 3.3. Module Trích Xuất File (`services/parser.py`)
- Hỗ trợ `.txt` với fallback bảng mã (UTF-8, UTF-16, CP1258).
- Hỗ trợ `.docx` qua `python-docx`.
- Hỗ trợ `.pdf` qua `pypdf`.
- Giới hạn file tối đa 10MB để bảo vệ bộ nhớ máy chủ.

---

## 4. Phần 3: Giao Diện Người Dùng (UI/UX) & Trình Phát Audio

- **Phong cách:** Modern Dark Glassmorphism Studio (Nền tối, thẻ kính mờ blur, viền phát sáng nhẹ, font Inter/Outfit).
- **Vùng nhập liệu (Input Workspace):**
  - Chuyển đổi linh hoạt giữa 2 tab: Nhập trực tiếp & Tải file.
  - Vùng kéo thả file tài liệu (Drag & drop) trực quan.
  - Bộ đếm ký tự & từ thời gian thực.
  - Nút mẫu thử nhanh (Quick Samples: Đọc tin tức, Đọc truyện cảm xúc).
- **Bảng điều khiển âm thanh (Voice & Audio Tuning):**
  - Dropdown chọn giọng (nhóm giọng Việt lên đầu, kèm cờ quốc gia).
  - 3 thanh trượt điều chỉnh: Tốc độ (Speed), Cao độ (Pitch), Âm lượng (Volume) kèm nút Đặt lại mặc định.
  - Phím tắt chuyển đổi nhanh: `Ctrl/Cmd + Enter`.
- **Trình phát nhạc (Audio Player Bar):**
  - Trình phát tùy biến cao cấp với hiệu ứng sóng âm (Waveform visualizer) nhảy theo âm lượng.
  - Thanh tua thời gian (Scrubber timeline), thời gian hiện tại / tổng thời lượng.
  - Nút Tải file MP3 trực tiếp.
- **Lịch sử gần đây (Recent Session History):**
  - Lưu danh sách 5 file âm thanh vừa tạo gần nhất trong phiên làm việc trên trình duyệt để nghe lại hoặc tải lại bất kỳ lúc nào.

---

## 5. Phần 4: Đóng Gói Docker/K8s, Xử Lý Lỗi & Chiến Lược Kiểm Thử

### 5.1. Đóng gói Docker & Docker Compose
- **Dockerfile**:
  - Base image `python:3.11-slim`.
  - Non-root user `appuser` (UID 10001) bảo mật cao.
  - Healthcheck `curl -f http://localhost:8000/api/health || exit 1`.
- **`docker-compose.yml`**:
  - Map port `8000:8000`.
  - Mount volume code hot-reload cho môi trường phát triển local.

### 5.2. Triển khai Kubernetes (`tts-app/k8s/`)
- **`deployment.yaml`**:
  - Replicas: 1-2.
  - Resource Requests (`128Mi` RAM, `100m` CPU), Limits (`512Mi` RAM, `500m` CPU).
  - Liveness Probe & Readiness Probe trỏ về `httpGet: /api/health` cổng 8000.
- **`service.yaml`**:
  - Service type `ClusterIP` hoặc `NodePort` (`nodePort: 30080`).

### 5.3. Xử lý lỗi & Độ ổn định (Error Handling)
- **Lỗi mạng / Rate Limit từ Edge-TTS**: Retry với exponential backoff 2 lần. Trả HTTP 503 kèm thông báo tiếng Việt nếu thất bại.
- **Lỗi File tải lên**: Trả HTTP 400 (định dạng sai) hoặc HTTP 413 (dung lượng > 10MB).
- **Lỗi Input rỗng**: Validate ở cả Client và Backend (trả HTTP 422).

### 5.4. Chiến lược kiểm thử tự động (Testing)
- Chạy qua `pytest`:
  - `test_chunker.py`: Test chia đoạn văn bản tiếng Việt ngắn, dài, dấu câu kép.
  - `test_parser.py`: Test đọc đúng file `.txt` (UTF-8, CP1258), `.docx`, `.pdf`.
  - `test_api.py`: Test các endpoints `/api/health`, `/api/voices`, `/api/synthesize` qua FastAPI TestClient.
