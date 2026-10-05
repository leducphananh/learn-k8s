# 🎙️ EchoTTS Studio

**EchoTTS Studio** là ứng dụng Web & API chuyển đổi văn bản thành giọng nói (Text-to-Speech) chất lượng cao bằng tiếng Việt và đa ngôn ngữ, sử dụng công nghệ Microsoft Edge Neural TTS.

Hệ thống hoạt động **hoàn toàn miễn phí, không yêu cầu API Key, không đòi hỏi GPU** và được thiết kế theo kiến trúc Microservice sẵn sàng đóng gói Docker và triển khai lên Kubernetes.

---

## ✨ Tính Năng Nổi Bật

- 🇻🇳 **Giọng đọc tiếng Việt tự nhiên**: Hỗ trợ 2 giọng chuẩn: **Hoài My** (Nữ - truyền cảm, nhẹ nhàng) và **Nam Minh** (Nam - trầm ấm, dõng dạc), cùng hơn 100+ giọng quốc tế.
- 📄 **Trích xuất tài liệu thông minh**: Kéo thả trực tiếp file `.txt`, `.docx` (Word) và `.pdf` để chuyển đổi sang giọng nói.
- ⚡ **Thuật toán Smart Auto-Chunking**: Tự động phân đoạn thông minh theo ngữ pháp và câu kết thúc (`.`, `!`, `?`, `…`), hỗ trợ xử lý bài viết dài hoặc sách nói mà không bị ngắt quãng hay timeout.
- 🎛️ **Tùy chỉnh âm thanh linh hoạt**: Tùy chỉnh Tốc độ đọc (Speed: 0.5x - 2.0x), Cao độ (Pitch: -50Hz - +50Hz), và Âm lượng (Volume).
- 🎨 **Giao diện Dark Glassmorphism Studio**: Giao diện tối sang trọng, hiện đại với hiệu ứng kính mờ, phím tắt `Ctrl + Enter`, và sóng âm phản hồi trực quan.
- 🎵 **Trình phát nhạc tích hợp**: Custom Audio Player với timeline scrubber, điều khiển âm lượng và nút tải file MP3 trực tiếp.
- 🕒 **Lịch sử phiên làm việc**: Lưu lại danh sách các file audio đã tạo để nghe lại và tải về dễ dàng.
- 🐳 **Đóng gói Docker & Kubernetes**: Có sẵn `Dockerfile`, `docker-compose.yml`, và manifests K8s (`deployment.yaml`, `service.yaml`).

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Cách 1: Chạy trực tiếp bằng Python (Cục bộ)

1. **Yêu cầu**: Python >= 3.11
2. **Cài đặt thư viện**:
   ```bash
   cd tts-app
   # Dùng uv (khuyên dùng):
   uv venv .venv
   source .venv/bin/activate
   uv pip install -r requirements.txt

   # Hoặc dùng pip truyền thống:
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. **Khởi chạy máy chủ**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. **Truy cập ứng dụng**:
   - Giao diện Web: [http://localhost:8000](http://localhost:8000)
   - API Docs (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Cách 2: Chạy bằng Docker Compose (Khuyên dùng cho Container)

Chỉ cần một lệnh duy nhất:
```bash
cd tts-app
docker compose up -d
```
Ứng dụng sẽ tự động được build và khởi chạy tại cổng `http://localhost:8000`.

---

### Cách 3: Triển khai lên Kubernetes (K8s)

1. **Build Docker Image**:
   ```bash
   cd tts-app
   docker build -t echotts-studio:latest .
   ```
2. **Áp dụng manifests**:
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```
3. **Kiểm tra trạng thái**:
   ```bash
   kubectl get pods -l app=echotts-studio
   kubectl get svc echotts-service
   ```
   Sau đó truy cập qua NodePort: `http://<Node-IP>:30080`.

---

## 📡 Đặc Tả REST API

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Kiểm tra trạng thái máy chủ (phục vụ K8s Health Probe) |
| `GET` | `/api/voices` | Lấy danh sách giọng đọc (ưu tiên tiếng Việt lên đầu) |
| `POST` | `/api/upload` | Tải file `.txt`, `.docx`, `.pdf` lên để lấy text sạch |
| `POST` | `/api/synthesize` | Chuyển văn bản thành luồng âm thanh MP3 (`audio/mpeg`) |

### Ví dụ gọi API `/api/synthesize`:
```bash
curl -X POST "http://localhost:8000/api/synthesize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Xin chào! Đây là giọng đọc nhân tạo từ EchoTTS Studio.",
    "voice": "vi-VN-HoaiMyNeural",
    "rate": "+0%",
    "pitch": "+0Hz",
    "volume": "+0%"
  }' \
  --output speech.mp3
```

---

## 🧪 Chạy Kiểm Thử Tự Động (Testing)

Dự án được xây dựng 100% theo phương pháp Test-Driven Development (TDD):

```bash
cd /Users/phananh/Documents/workspace/PhanAnh/self/learn-k8s
PYTHONPATH=tts-app tts-app/.venv/bin/pytest tts-app/tests/ -v
```
Toàn bộ 21 test case (kiem tra Health API, Parser, Chunker, Edge-TTS streaming, REST API, và Frontend Static) đều vượt qua xuất sắc.
