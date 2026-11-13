# Kubernetes - Cẩm Nang Gỡ Lỗi (Troubleshooting & Debugging)

Tài liệu này hướng dẫn quy trình gỡ lỗi chuẩn mực trong Kubernetes, giải thích nguyên nhân và dấu hiệu của các trạng thái lỗi phổ biến nhất (`ImagePullBackOff`, `CrashLoopBackOff`, `Pending`, `OOMKilled`), cùng kịch bản thực hành gỡ lỗi trực tiếp với file `broken-deployment.yaml`.

---

## 1. Tại sao cần quy trình chuẩn khi gỡ lỗi K8s?

Trong môi trường máy chủ truyền thống (VM / VPS), khi có lỗi bạn thường SSH vào server và xem file syslog.

Trong Kubernetes:
* Pod có tính **tạm thời (ephemeral)**, có thể bị xoá và tạo lại tự động.
* Ứng dụng chạy đóng gói trong container bị cô lập.
* Lỗi có thể xuất phát từ nhiều tầng: **Cấu hình K8s (Manifest) $\rightarrow$ Tải Image $\rightarrow$ Lập lịch Node $\rightarrow$ Code ứng dụng $\rightarrow$ Mạng/Service**.

Nếu không có quy trình, bạn sẽ mất nhiều thời gian đoán mò. Kubernetes đã tích hợp sẵn công cụ cung cấp thông tin cực kỳ chi tiết, chỉ cần bạn biết **đọc đúng nơi, hỏi đúng lệnh**.

---

## 2. Quy trình 4 bước vàng để gỡ lỗi Pod

Bất cứ khi nào một Pod không chạy như mong muốn, hãy tuân theo **4 bước tuần tự** sau:

```text
  [ Bước 1: kubectl get pods ]
       │
       ▼ (Xác định triệu chứng: Status là gì? Có Restart không?)
  [ Bước 2: kubectl describe pod <tên-pod> ]
       │
       ▼ (Soi bảng Events ở cuối - giải quyết được 80-90% vấn đề)
  [ Bước 3: kubectl logs <tên-pod> ]
       │
       ▼ (Đọc log ứng dụng stdout/stderr nếu container đã khởi chạy)
  [ Bước 4: kubectl exec -it <tên-pod> -- sh ]
         (Vào bên trong container kiểm tra file, mạng, biến môi trường)
```

### Bước 1: `kubectl get pods` — Quan sát trạng thái tổng quan
```bash
kubectl get pods -o wide
```
* **Cột `STATUS`:** Cho biết Pod đang ở giai đoạn nào (`Running`, `Pending`, `CrashLoopBackOff`, `ErrImagePull`...).
* **Cột `RESTARTS`:** Nếu số lần restart tăng liên tục (1, 2, 5, 10...), chứng tỏ ứng dụng bị crash sau khi chạy.
* **Cột `READY`:** Dạng `0/1` nghĩa là container chưa sẵn sàng nhận traffic (thường do probe chưa pass).

### Bước 2: `kubectl describe pod <tên-pod>` — Vũ khí gỡ lỗi số 1
```bash
kubectl describe pod <tên-pod>
```
* Cuộn xuống **phần cuối cùng (mục `Events`)**: Đây là nhật ký ghi lại mọi hành động của K8s (kéo image, gán node, mount volume, probe thất bại...).
* Kiểm tra mục `State` và `Last State` của Containers để biết mã thoát (`Exit Code`).

### Bước 3: `kubectl logs <tên-pod>` — Đọc log ứng dụng
```bash
# Xem log hiện tại
kubectl logs <tên-pod>

# Xem log theo thời gian thực (real-time stream)
kubectl logs -f <tên-pod>

# CỰC KỲ QUAN TRỌNG: Xem log của lần chạy TRƯỚC ĐÓ nếu Pod bị restart liên tục
kubectl logs <tên-pod> --previous
```

### Bước 4: `kubectl exec -it <tên-pod> -- sh` — Khảo sát bên trong
Chỉ áp dụng khi container đang ở trạng thái `Running`:
```bash
kubectl exec -it <tên-pod> -- sh
# Kiểm tra DNS / Mạng
ping <service-name>
wget -qO- http://localhost:80
# Kiểm tra biến môi trường
env
```

---

## 3. Bảng chẩn đoán các lỗi thường gặp trong Kubernetes

| Trạng thái (STATUS) | Ý nghĩa | Nguyên nhân thường gặp | Lệnh cần chạy để kiểm tra |
| :--- | :--- | :--- | :--- |
| **`ImagePullBackOff`** / **`ErrImagePull`** | K8s không thể tải container image về máy | • Sai tên image hoặc sai tag (ví dụ: gõ nhầm version)<br>• Image nằm trong private registry nhưng chưa cấu hình `imagePullSecrets`<br>• Mất mạng hoặc Docker Hub bị giới hạn rate limit | `kubectl describe pod <tên-pod>` (xem mục Events) |
| **`CrashLoopBackOff`** | Container khởi động được nhưng crash ngay lập tức, K8s thử bật lại nhưng lại chết tiếp | • Lỗi cú pháp code ứng dụng / lỗi unhandled exception<br>• Thiếu biến môi trường (Environment variables)<br>• Sai lệnh khởi động (`command` / `args`)<br>• Không kết nối được Database khi start app | `kubectl logs <tên-pod> --previous`<br>`kubectl describe pod <tên-pod>` (kiểm tra Exit Code) |
| **`OOMKilled`** (Exit Code 137) | Out Of Memory - Container dùng vượt quá RAM cho phép | • Cấu hình `resources.limits.memory` quá thấp<br>• Ứng dụng bị rò rỉ bộ nhớ (memory leak) | `kubectl describe pod <tên-pod>` (tìm chữ `OOMKilled: true` trong mục Last State) |
| **`Pending`** | Pod đã tạo nhưng chưa được gán vào Node nào | • Cụm máy chủ hết RAM hoặc CPU<br>• Pod yêu cầu PersistentVolumeClaim (PVC) nhưng chưa có ổ đĩa nào thỏa mãn<br>• Node bị dính Taint hoặc nodeSelector không khớp | `kubectl describe pod <tên-pod>` (Events sẽ ghi rõ lý do không schedule được) |
| **`CreateContainerConfigError`** | Không thể cấu hình để tạo container | • Khai báo `configMapKeyRef` hoặc `secretKeyRef` trỏ đến ConfigMap/Secret không tồn tại | `kubectl describe pod <tên-pod>` |
| **`Running` nhưng không truy cập được** | Pod xanh nhưng request gửi tới bị lỗi / timeout | • Lệch nhãn `selector` giữa Service và Pod (xem lại bài `07-deployment`)<br>• Cấu hình Readiness Probe bị fail khiến Pod không được đưa vào Endpoint | `kubectl get endpoints <tên-service>`<br>`kubectl describe pod <tên-pod>` |

---

## 4. Kịch bản thực hành: Gỡ lỗi với `broken-deployment.yaml`

Trong thư mục `10-debug/` có sẵn file `broken-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: broken-app
  template:
    metadata:
      labels:
        app: broken-app
    spec:
      containers:
        - name: broken-app
          image: nginx:this-image-does-not-exist
          ports:
            - containerPort: 80
```

Nhìn vào file, image đang được khai báo là: `nginx:this-image-does-not-exist` (image không tồn tại).

### Bước 1: Triển khai file lỗi lên Cluster
```bash
kubectl apply -f 10-debug/broken-deployment.yaml
```

### Bước 2: Quan sát hiện tượng
Chạy lệnh kiểm tra danh sách Pod:
```bash
kubectl get pods -l app=broken-app -w
```
👉 **Bạn sẽ thấy quá trình:**
`ContainerCreating` $\rightarrow$ `ErrImagePull` $\rightarrow$ `ImagePullBackOff`.
Cột `READY` hiển thị `0/1`.

### Bước 3: Truy vết nguyên nhân bằng `describe`
```bash
kubectl describe pod -l app=broken-app
```
Cuộn xuống phần **Events**, bạn sẽ thấy thông báo lỗi rõ ràng:
```text
Events:
  Type     Reason     Age                From               Message
  ----     ------     ----               ----               -------
  Normal   Scheduled  45s                default-scheduler  Successfully assigned default/broken-app-... to orbstack
  Normal   Pulling    15s (x3 over 44s)  kubelet            Pulling image "nginx:this-image-does-not-exist"
  Warning  Failed     14s (x3 over 43s)  kubelet            Failed to pull image "nginx:this-image-does-not-exist": ... not found
  Warning  Failed     14s (x3 over 43s)  kubelet            Error: ErrImagePull
  Normal   BackOff    2s (x4 over 42s)   kubelet            Back-off pulling image "nginx:this-image-does-not-exist"
  Warning  Failed     2s (x4 over 42s)   kubelet            Error: ImagePullBackOff
```
Kubelet nói rất rõ: **Không tìm thấy image `nginx:this-image-does-not-exist`**!

---

### Bước 4: Sửa lỗi (Fixing)

Bạn có 2 cách để sửa lỗi này:

#### Cách 1: Sửa trực tiếp trên Deployment bằng dòng lệnh (Khuyên dùng khi test nhanh)
Đổi image của container `broken-app` sang image đúng `nginx:alpine`:
```bash
kubectl set image deployment/broken-app broken-app=nginx:alpine
```

#### Cách 2: Sửa file YAML rồi apply lại (Chuẩn quy trình GitOps)
Mở file `10-debug/broken-deployment.yaml`, đổi dòng `image:` thành:
```yaml
          image: nginx:alpine
```
Sau đó chạy:
```bash
kubectl apply -f 10-debug/broken-deployment.yaml
```

---

### Bước 5: Kiểm tra kết quả sau khi sửa
```bash
kubectl get pods -l app=broken-app
```
👉 Bạn sẽ thấy Pod cũ bị xoá và một Pod mới được kéo image thành công, trạng thái chuyển sang:
```text
NAME                          READY   STATUS    RESTARTS   AGE
broken-app-76b9b8b64b-xxxxx   1/1     Running   0          10s
```

---

### Bước 6: Dọn dẹp tài nguyên
```bash
kubectl delete -f 10-debug/broken-deployment.yaml
```

---

## 5. Tổng hợp các câu lệnh kubectl gỡ lỗi nâng cao

| Mục đích | Câu lệnh |
| :--- | :--- |
| **Xem các Pod bị lỗi / restart nhiều nhất** | `kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'` |
| **Xem toàn bộ Events trong namespace theo thời gian** | `kubectl get events --sort-by='.metadata.creationTimestamp'` |
| **Lọc chỉ xem các Event loại Cảnh báo (Warning)** | `kubectl get events --field-selector type=Warning` |
| **Xem log của tất cả Pod mang cùng một nhãn** | `kubectl logs -l app=broken-app --tail=50` |
| **Xem log của container cụ thể (nếu Pod có nhiều container)** | `kubectl logs <tên-pod> -c <tên-container>` |
| **Theo dõi mức sử dụng tài nguyên CPU/RAM** | `kubectl top pods` *(Yêu cầu cluster đã cài metrics-server)* |

