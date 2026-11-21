# Kubernetes - Khái niệm Cơ Bản về Volume & emptyDir

Tài liệu này giải thích chi tiết về **Volume trong Kubernetes**, vòng đời lưu trữ của container, cơ chế chia sẻ dữ liệu giữa các container trong cùng một Pod bằng **`emptyDir`**, cùng kịch bản thực hành từng bước với file `emptydir.yaml`.

---

## 1. Vấn đề của lưu trữ trong Container & Tại sao cần Volume?

Mặc định, hệ thống tập tin (filesystem) của một container có tính chất **tạm thời (ephemeral)**:
1. **Dữ liệu bị mất khi container restart:** Khi ứng dụng bị crash hoặc container khởi động lại, mọi dữ liệu được ghi vào container sẽ biến mất và quay về trạng thái ban đầu của image.
2. **Không thể chia sẻ file giữa các container:** Hai container chạy cạnh nhau trong cùng một Pod mặc định bị cô lập filesystem, không thể đọc file của nhau.

👉 **Kubernetes Volume** giải quyết triệt để 2 vấn đề trên:
* **Bảo toàn dữ liệu qua các lần restart của container** (chừng nào Pod còn tồn tại).
* **Chia sẻ dữ liệu dùng chung (Shared Storage)** giữa các container chạy trong cùng một Pod (mô hình Multi-container / Sidecar pattern).

---

## 2. `emptyDir` là gì?

`emptyDir` là loại Volume đơn giản nhất trong Kubernetes:
* **Khởi tạo:** Khi một Pod được gán vào Node, K8s sẽ tự động tạo một thư mục trống rỗng (`emptyDir`).
* **Chia sẻ:** Mọi container bên trong Pod đều có thể mount vào `emptyDir` này để đọc/ghi dữ liệu chung.
* **Vòng đời:** Gắn liền trực tiếp với **vòng đời của Pod**:
  * Nếu một container trong Pod bị crash hoặc restart $\rightarrow$ Dữ liệu trong `emptyDir` **VẪN ĐƯỢC GIỮ NGUYÊN**.
  * Nếu Pod bị xoá (hoặc di chuyển sang Node khác) $\rightarrow$ Dữ liệu trong `emptyDir` sẽ **BỊ XOÁ VĨNH VIỄN**.

### Các trường hợp thực tế thường dùng `emptyDir`:
* **Vùng nhớ đệm (Scratch Space):** Lưu các file tạm trong quá trình xử lý (nén ảnh, parse file, build code).
* **Chia sẻ dữ liệu dạng Producer - Consumer:** Một container tải file/tạo log, container phụ (sidecar) đọc và đẩy dữ liệu lên hệ thống giám sát.
* **Bộ nhớ đệm siêu tốc (In-Memory Cache):** Cấu hình `emptyDir` lưu trực tiếp trên RAM (`medium: Memory`) dùng làm RAM disk (tmpfs).

---

## 3. Giải thích cấu hình `emptydir.yaml`

File `13-volume/emptydir.yaml` mô phỏng mô hình kinh điển: **1 Container Ghi (Writer) và 1 Container Đọc (Reader)**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-volume-demo
spec:
  containers:
    # 1. Container GHI: Cứ mỗi 5 giây ghi ngày giờ vào /data/time.txt
    - name: writer
      image: busybox:1.36
      command: ['sh', '-c']
      args:
        - |
          while true; do
            date >> /data/time.txt
            sleep 5
          done
      volumeMounts:
        - name: shared-data
          mountPath: /data       # Gắn volume vào đường dẫn /data của container writer

    # 2. Container ĐỌC: Chạy nền để chúng ta vào đọc file
    - name: reader
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
      volumeMounts:
        - name: shared-data
          mountPath: /data       # Gắn cùng volume vào đường dẫn /data của container reader

  # 3. Khai báo Volume dùng chung ở cấp độ Pod
  volumes:
    - name: shared-data
      emptyDir: {}               # Khởi tạo thư mục rỗng
```

### Mô hình hoạt động:
```text
           [ Pod: shared-volume-demo ]
 ┌──────────────────────────────────────────────┐
 │                                              │
 │  [ Container: writer ]   [ Container: reader ]│
 │         │                       ▲            │
 │     ghi │                       │ đọc        │
 │         ▼                       │            │
 │    (/data/time.txt)        (/data/time.txt)  │
 │         └───────────┬───────────┘            │
 │                     ▼                        │
 │           [ Volume: shared-data ]            │
 │                 (emptyDir)                   │
 └──────────────────────────────────────────────┘
```

> 💡 **Mẹo nâng cao (RAM Disk):**  
> Nếu bạn muốn `emptyDir` lưu trên RAM máy chủ để đạt tốc độ đọc ghi tối đa (tmpfs):
> ```yaml
>   volumes:
>     - name: shared-data
>       emptyDir:
>         medium: Memory       # Dữ liệu nằm trên RAM, không ghi xuống ổ cứng
>         sizeLimit: 128Mi     # Giới hạn dung lượng tối đa
> ```

---

## 4. Kịch bản thực hành từng bước

### Bước 1: Khởi tạo Pod
```bash
kubectl apply -f 13-volume/emptydir.yaml
```

Kiểm tra trạng thái Pod:
```bash
kubectl get pods
```
👉 **Điểm đặc biệt cần chú ý:**  
Cột `READY` hiển thị là **`2/2`** (thay vì `1/1` như các bài trước). Điều này có nghĩa là **cả 2 container** (`writer` và `reader`) đều đang chạy đồng thời bên trong Pod này.

---

### Bước 2: Kiểm tra chia sẻ dữ liệu giữa 2 container

Mặc dù container `writer` là bên ghi file `/data/time.txt`, chúng ta sẽ dùng container `reader` để đọc file này:

```bash
# Đọc nội dung file từ container reader:
kubectl exec -it shared-volume-demo -c reader -- cat /data/time.txt
```

👉 **Kết quả:** Bạn sẽ thấy danh sách các dòng ngày giờ xuất hiện!

Thử theo dõi dữ liệu mới ghi vào theo thời gian thực:
```bash
kubectl exec -it shared-volume-demo -c reader -- tail -f /data/time.txt
```
👉 Cứ mỗi 5 giây, một dòng thời gian mới sẽ nhảy lên màn hình!  
*(Nhấn `Ctrl + C` để thoát)*.

---

### Bước 3: Thử nghiệm tính bền vững khi Container restart

1. Tìm và tiêu diệt (kill) tiến trình trong container `writer`:
   ```bash
   kubectl exec -it shared-volume-demo -c writer -- kill 1
   ```
2. Chạy `kubectl get pods`: bạn sẽ thấy cột `RESTARTS` của Pod tăng lên 1 (container writer vừa crash và được K8s tự động bật lại).
3. Đọc lại file từ container `reader`:
   ```bash
   kubectl exec -it shared-volume-demo -c reader -- cat /data/time.txt
   ```
👉 **Bài học:** Dữ liệu thời gian trước lúc crash **vẫn còn nguyên vẹn**, không bị xoá mất!

---

### Bước 4: Thử nghiệm khi xoá Pod (Vòng đời của emptyDir)

1. Xoá Pod:
   ```bash
   kubectl delete -f 13-volume/emptydir.yaml
   ```
2. Tạo lại Pod:
   ```bash
   kubectl apply -f 13-volume/emptydir.yaml
   ```
3. Đọc lại file:
   ```bash
   kubectl exec -it shared-volume-demo -c reader -- cat /data/time.txt
   ```
👉 **Bài học:** Các dòng log cũ của lần chạy trước đã biến mất hoàn toàn. File được ghi lại từ đầu.  
Điều này chứng minh: **Khi Pod chết, toàn bộ dữ liệu trong `emptyDir` sẽ bị xoá vĩnh viễn.**

---

### Bước 5: Dọn dẹp tài nguyên
```bash
kubectl delete -f 13-volume/emptydir.yaml
```

Xác nhận lại:
```bash
kubectl get pods
```

---

## 5. Tổng quan các loại Volume phổ biến trong Kubernetes

| Loại Volume | Dữ liệu lưu ở đâu? | Tồn tại bao lâu? | Ứng dụng thực tế |
| :--- | :--- | :--- | :--- |
| **`emptyDir`** | Ổ cứng Node hoặc RAM | Chết cùng với Pod | Bộ nhớ đệm (cache), file tạm, chia sẻ giữa container trong 1 Pod |
| **`hostPath`** | Thư mục của máy chủ Node | Lưu trên Node cụ thể | Pod cần truy cập tài nguyên máy chủ (Docker socket, log hệ thống Node) |
| **`configMap` / `secret`** | Ram / Bộ nhớ K8s | Gắn theo tài nguyên | Nạp file cấu hình, file chứng chỉ SSL |
| **`PersistentVolume (PV)`** | Ổ đĩa đám mây độc lập (EBS, NFS, Ceph...) | **Vĩnh viễn** (Không mất khi Pod xoá) | Cơ sở dữ liệu (MySQL, PostgreSQL, MongoDB, Redis) |

---

## 6. Các câu lệnh `kubectl` thiết yếu với Multi-Container Pod

Khi một Pod có từ 2 container trở lên, lệnh `kubectl` luôn cần cờ **`-c <tên-container>`**:

| Mục đích | Câu lệnh |
| :--- | :--- |
| **Xem log của container cụ thể** | `kubectl logs <tên-pod> -c <tên-container>` |
| **Theo dõi log trực tiếp của container** | `kubectl logs -f <tên-pod> -c <tên-container>` |
| **Mở terminal vào container cụ thể** | `kubectl exec -it <tên-pod> -c <tên-container> -- sh` |
| **Chạy 1 lệnh trong container cụ thể** | `kubectl exec <tên-pod> -c <tên-container> -- <lệnh>` |
