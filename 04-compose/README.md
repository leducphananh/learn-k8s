# Docker Compose - Ứng dụng Đa Container (Backend + PostgreSQL)

Tài liệu này tổng hợp kiến trúc, giải thích cấu hình `compose.yaml` và danh sách các lệnh Docker Compose cần nắm vững.

---

## 1. Cấu trúc thư mục

```text
04-compose/
├── backend/
│   ├── Dockerfile       # Đóng gói Node.js app
│   ├── package.json     # Chứa dependency "pg" (PostgreSQL client)
│   └── server.js        # API server với 3 endpoint: /, /health, /db
├── compose.yaml         # File định nghĩa toàn bộ hạ tầng (services, network, volumes)
└── README.md            # Tài liệu hướng dẫn
```

---

## 2. Giải thích cấu hình `compose.yaml`

```yaml
services:
  backend:
    build:
      context: ./backend          # Build image từ Dockerfile trong thư mục ./backend
    ports:
      - '8080:3000'               # Cổng 8080 máy thật (host) -> Cổng 3000 của container
    environment:
      APP_ENV: development
      PORT: 3000
      DB_HOST: postgres           # Tên service postgres đóng vai trò là domain/hostname
      DB_PORT: 5432
      DB_NAME: app
      DB_USER: app
      DB_PASSWORD: app
    depends_on:
      postgres:
        condition: service_healthy # Chờ postgres qua được bài kiểm tra healthcheck mới khởi động backend

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    volumes:
      - postgres-data:/var/lib/postgresql/data  # Giữ lại dữ liệu database khi tắt/bật container
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d app'] # Lệnh kiểm tra DB đã sẵn sàng nhận kết nối chưa
      interval: 5s               # Kiểm tra mỗi 5 giây
      timeout: 5s                # Quá 5 giây coi như fail
      retries: 5                 # Thử lại 5 lần

volumes:
  postgres-data:                 # Khai báo named volume cho postgres
```

### Các khái niệm quan trọng:
1. **Service Discovery (DNS nội bộ):**
   - Docker Compose tự tạo một mạng riêng (bridge network) cho các service.
   - Các container có thể gọi nhau bằng **chính tên service** (ví dụ: `DB_HOST: postgres`).
   - *Lưu ý*: Nếu bạn đặt `DB_HOST: wrong-postgres`, backend sẽ báo lỗi `getaddrinfo ENOTFOUND wrong-postgres` do không tìm thấy DNS này trong mạng nội bộ.
2. **`depends_on` với `condition: service_healthy`:**
   - Bình thường `depends_on` chỉ đợi container DB "bật lên" chứ không đảm bảo DB đã sẵn sàng nhận kết nối.
   - Dùng kèm `condition: service_healthy` giúp backend chỉ khởi động sau khi câu lệnh `pg_isready` trong DB chạy thành công.
3. **Volume (`postgres-data`):**
   - Giúp dữ liệu trong Postgres không bị mất khi bạn dừng hoặc xoá container.

---

## 3. Tổng hợp các lệnh Docker Compose thường dùng

### Khởi chạy ứng dụng
| Lệnh | Chức năng |
| :--- | :--- |
| `docker compose up` | Khởi chạy toàn bộ services và in log trực tiếp ra terminal hiện tại |
| `docker compose up -d` | Khởi chạy toàn bộ services chạy ngầm dưới nền (Detached mode) |
| `docker compose up --build -d` | **Bắt buộc build lại image** rồi mới chạy (dùng khi bạn vừa sửa code backend) |

### Kiểm tra trạng thái và xem Log
| Lệnh | Chức năng |
| :--- | :--- |
| `docker compose ps` | Xem danh sách các container thuộc project và trạng thái (`healthy`, `running`, ports...) |
| `docker compose logs` | Xem log của tất cả services |
| `docker compose logs backend` | Chỉ xem log của service `backend` |
| `docker compose logs -f backend` | Xem và stream log thời gian thực của `backend` (nhấn `Ctrl + C` để thoát) |

### Tương tác với Container đang chạy
| Lệnh | Chức năng |
| :--- | :--- |
| `docker compose exec backend sh` | Mở terminal tương tác bên trong container `backend` |
| `docker compose exec postgres psql -U app -d app` | Mở trực tiếp giao diện dòng lệnh `psql` của PostgreSQL |
| `docker compose restart backend` | Khởi động lại riêng service `backend` |

### Dừng và Dọn dẹp
| Lệnh | Chức năng |
| :--- | :--- |
| `docker compose stop` | Tạm dừng các container (không xoá container và mạng) |
| `docker compose down` | Dừng và **xoá toàn bộ container, network** của project |
| `docker compose down -v` | Dừng, xoá container, network **và xoá luôn toàn bộ volume dữ liệu** (`postgres-data`) |
| `docker compose down -v --rmi all` | Dọn dẹp triệt để nhất: xoá container, network, volume và cả các images vừa build/pull |

---

## 4. Các lỗi thường gặp (Troubleshooting)

1. **`no configuration file provided: not found`**:
   - **Nguyên nhân**: Đang đứng ở thư mục không chứa file `compose.yaml`.
   - **Xử lý**: `cd 04-compose` trước khi chạy hoặc dùng cờ `-f 04-compose/compose.yaml`.

2. **Lỗi kết nối cơ sở dữ liệu (`ECONNREFUSED` hoặc `ENOTFOUND`)**:
   - Kiểm tra `DB_HOST` trong file compose xem đã trùng với tên service `postgres` hay chưa.
   - Kiểm tra xem service `postgres` đã `healthy` chưa bằng lệnh `docker compose ps`.
