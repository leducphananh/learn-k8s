# Tổng hợp các lệnh Docker cơ bản đã sử dụng

Tài liệu này giải thích chi tiết các lệnh Docker đã thực hành trong thư mục `03-docker`.

---

## 1. Build Image từ Dockerfile

```bash
docker build -t docker-learning:1.0 .
```

* **Chức năng**: Đóng gói mã nguồn và Dockerfile thành một Docker Image.
* **Chi tiết tham số**:
  * `-t docker-learning:1.0` (`--tag`): Đặt tên cho image là `docker-learning` với phiên bản/tag là `1.0`. Nếu không truyền tag, mặc định sẽ là `latest`.
  * `.` (dấu chấm): Đường dẫn đến **Build Context** (thư mục hiện tại chứa `Dockerfile` và mã nguồn cần copy vào image).

---

## 2. Kiểm tra danh sách Image

```bash
docker image ls
# Hoặc lệnh rút gọn:
docker images
```

* **Chức năng**: Liệt kê danh sách tất cả các Docker Image hiện có trên máy local.
* **Thông tin hiển thị**: `REPOSITORY`, `TAG`, `IMAGE ID`, thời gian tạo (`CREATED`), và kích thước (`SIZE`).

---

## 3. Khởi chạy Container cơ bản

```bash
docker run \
  --name docker-learning \
  -p 8080:3000 \
  docker-learning:1.0
```

* **Chức năng**: Tạo và khởi chạy một container mới từ image `docker-learning:1.0`.
* **Chi tiết tham số**:
  * `--name docker-learning`: Đặt tên định danh cho container là `docker-learning` để tiện quản lý (thay vì Docker tự sinh tên ngẫu nhiên).
  * `-p 8080:3000` (`--publish`): Ánh xạ cổng theo cú pháp `PORT_MÁY_THẬT:PORT_CONTAINER`.
    * Cổng `8080` trên máy của bạn (host) sẽ chuyển tiếp vào cổng `3000` của ứng dụng Node.js bên trong container.
  * *Mẹo*: Thêm cờ `-d` (`--detach`) nếu muốn container chạy ngầm dưới nền.

---

## 4. Xoá Container

```bash
docker rm -f docker-learning
```

* **Chức năng**: Xoá bỏ container có tên `docker-learning`.
* **Chi tiết tham số**:
  * `-f` (`--force`): Ép buộc dừng (kill) container nếu nó đang chạy trước khi xoá. Nếu không có `-f`, bạn phải chạy `docker stop docker-learning` trước rồi mới `docker rm` được.

---

## 5. Chạy Container với Biến Môi Trường (Environment Variable)

```bash
docker run \
  --name docker-learning \
  -p 8080:3000 \
  -e APP_ENV=production \
  docker-learning:1.0
```

* **Chức năng**: Khởi chạy container đồng thời tiêm biến môi trường vào ứng dụng.
* **Chi tiết tham số**:
  * `-e APP_ENV=production` (`--env`): Thiết lập biến môi trường `APP_ENV` với giá trị `production`.
  * Đoạn mã trong `server.js` (`process.env.APP_ENV`) sẽ đọc được giá trị này và trả về trong phản hồi JSON.

---

## 6. Kiểm tra các Container đang hoạt động

```bash
docker ps
```

* **Chức năng**: Liệt kê danh sách các container **đang chạy**.
* **Mẹo mở rộng**:
  * `docker ps -a`: Liệt kê **tất cả** container (bao gồm cả các container đã dừng/Exited).

---

## 7. Xem Log của Container

```bash
docker logs docker-learning
```

* **Chức năng**: In ra toàn bộ log đầu ra (`stdout` / `stderr`) do ứng dụng bên trong container tạo ra (ví dụ: `Server running on port 3000`).
* **Mẹo mở rộng**:
  * `docker logs -f docker-learning`: Theo dõi log trực tiếp theo thời gian thực (giống `tail -f`).

---

## 8. Xem thông tin chi tiết Container

```bash
docker inspect docker-learning
```

* **Chức năng**: Trả về toàn bộ thông tin chi tiết cấp thấp (low-level) của container dưới định dạng JSON.
* **Bao gồm**: Địa chỉ IP nội bộ của container, cấu hình mạng, cổng forward, biến môi trường, mount ổ đĩa, trạng thái tài nguyên, v.v.

---

## 9. Truy cập vào Terminal bên trong Container

```bash
docker exec -it docker-learning sh
```

* **Chức năng**: Mở một phiên làm việc shell tương tác trực tiếp bên trong container đang chạy.
* **Chi tiết tham số**:
  * `exec`: Chạy một tiến trình/lệnh bên trong container đang hoạt động.
  * `-i` (`--interactive`): Giữ luồng STDIN mở (cho phép nhập liệu từ bàn phím).
  * `-t` (`--tty`): Cấp phát giao diện dòng lệnh (pseudo-TTY).
  * `sh`: Lệnh shell cần chạy (do base image `node:22-alpine` dùng Alpine Linux nên dùng `sh` thay vì `bash`).
* *Thoát ra*: Gõ `exit` để rời khỏi container.

---

## 10. Lệnh bổ sung hữu ích

| Lệnh | Chức năng |
| :--- | :--- |
| `docker stop <tên_container>` | Dừng container đang chạy |
| `docker rmi <tên_image:tag>` | Xoá một Docker Image khỏi máy |
| `docker system prune` | Dọn dẹp các container đã dừng, network và image không dùng đến |
