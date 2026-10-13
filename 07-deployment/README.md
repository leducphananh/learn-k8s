# Kubernetes - Khái niệm Cơ Bản về Deployment

Tài liệu này giải thích chi tiết kiến trúc của **Deployment**, cấu trúc manifest `deployment.yaml`, mối quan hệ giữa Deployment - ReplicaSet - Pod, và danh sách các câu lệnh `kubectl` thiết yếu để kiểm tra, gỡ lỗi và vận hành.

---

## 1. Deployment là gì? Tại sao không dùng Pod đơn lẻ?

Trong bài học trước (`06-pod`), chúng ta đã biết **Pod có tính tạm thời (ephemeral)** và **không có khả năng tự phục hồi (self-healing)**. Nếu 1 Pod bị chết, không ai tạo lại nó.

Trong môi trường thực tế, **Deployment** là giải pháp chuẩn mực vì nó mang lại:
* **Tự động duy trì số lượng Pod (Replicas & Self-healing):** Khai báo cần chạy 3 Pod, K8s sẽ luôn giữ đúng 3 Pod. Nếu 1 Pod bị crash hoặc bị xoá thủ công, Deployment sẽ lập tức sinh Pod mới thay thế.
* **Cập nhật không gián đoạn (Zero-downtime Rolling Update):** Khi cập nhật image phiên bản mới, Deployment sẽ lần lượt tạo Pod mới và chỉ xoá Pod cũ khi Pod mới đã sẵn sàng nhận tải.
* **Quay lui phiên bản (Rollback):** Nếu phiên bản mới bị lỗi, bạn có thể hoàn tác về phiên bản trước chỉ bằng 1 câu lệnh.
* **Mở rộng dễ dàng (Scaling):** Tăng hoặc giảm số lượng Pod nhanh chóng theo nhu cầu tải.

---

## 2. Mô hình phân tầng: Deployment $\rightarrow$ ReplicaSet $\rightarrow$ Pod

Khi bạn tạo một **Deployment**:
1. Deployment sẽ tự động tạo ra một **ReplicaSet**.
2. ReplicaSet chịu trách nhiệm trực tiếp giám sát và duy trì đúng số lượng **Pods**.

```text
[ Deployment: nginx-deployment ]
              │
              ▼
    [ ReplicaSet: nginx-deployment-xxxx ]
              │
      ┌───────┼───────┐
      ▼       ▼       ▼
    [Pod 1] [Pod 2] [Pod 3]
```

> **Ghi nhớ:** Người dùng chỉ cần làm việc với **Deployment**. K8s sẽ tự động điều phối ReplicaSet ở tầng bên dưới.

---

## 3. Giải thích cấu hình `deployment.yaml`

```yaml
apiVersion: apps/v1          # 1. Nhóm API quản lý ứng dụng (apps/v1)
kind: Deployment             # 2. Loại tài nguyên là Deployment

metadata:                    # 3. Thông tin định danh của Deployment
  name: nginx-deployment     # Tên của Deployment

spec:                        # 4. Trạng thái mong muốn (Desired State)
  replicas: 3                # Duy trì 3 bản sao Pod chạy đồng thời

  selector:                  # Bộ chọn để tìm và quản lý Pod
    matchLabels:
      app: nginx             # ⚠️ BẮT BUỘC KHỚP VỚI template.metadata.labels

  template:                  # Khuôn mẫu để sinh ra các Pod mới
    metadata:
      labels:
        app: nginx           # Gắn nhãn này lên mỗi Pod được sinh ra
    spec:
      containers:
        - name: nginx        # Tên container trong Pod
          image: nginx:alpine # Docker Image từ Docker Hub
          ports:
            - containerPort: 80 # Cổng container lắng nghe
```

### ⚠️ Điểm mấu chốt: Cầu nối Labels & Selector
* `spec.selector.matchLabels` và `spec.template.metadata.labels` **bắt buộc phải giống nhau** (`app: nginx`).
* Nếu hai giá trị này lệch nhau, Kubernetes sẽ báo lỗi cú pháp ngay khi `apply` vì Deployment không thể quản lý các Pod do chính nó tạo ra.

---

## 4. Tổng hợp các câu lệnh `kubectl` với Deployment

### Khởi tạo & Quản lý cơ bản
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl apply -f 07-deployment/deployment.yaml` | Tạo mới hoặc cập nhật Deployment từ file YAML |
| `kubectl get deployments` | Xem danh sách Deployment (trạng thái `READY`, `UP-TO-DATE`, `AVAILABLE`) |
| `kubectl get rs` | Xem ReplicaSet do Deployment quản lý |
| `kubectl get pods -l app=nginx` | Xem danh sách các Pod thuộc Deployment (lọc theo label) |
| `kubectl get pods -o wide` | Xem chi tiết địa chỉ IP nội bộ và tên Node chạy từng Pod |
| `kubectl get pods -w` | Theo dõi trạng thái Pod liên tục theo thời gian thực (Watch mode) |

### Kiểm tra chi tiết & Gỡ lỗi (Troubleshooting)
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl describe deployment nginx-deployment` | **Rất quan trọng:** Xem cấu hình chi tiết và bảng **Events** (lý do tạo/lỗi của Deployment) |
| `kubectl rollout status deployment/nginx-deployment` | Xem tiến độ cập nhật/triển khai các Pod |
| `kubectl logs -l app=nginx --tail=50` | Xem log của toàn bộ các Pod thuộc Deployment cùng lúc |
| `kubectl logs -f deployment/nginx-deployment` | Theo dõi luồng log của Deployment theo thời gian thực |

### Mở rộng (Scaling) & Cập nhật (Rolling Update)
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl scale deployment nginx-deployment --replicas=5` | Tăng số lượng Pod lên 5 trực tiếp bằng dòng lệnh |
| `kubectl scale deployment nginx-deployment --replicas=2` | Giảm số lượng Pod xuống 2 |
| `kubectl set image deployment/nginx-deployment nginx=nginx:1.25-alpine` | Nâng cấp image container lên phiên bản mới |
| `kubectl rollout history deployment/nginx-deployment` | Xem lịch sử các phiên bản sửa đổi (Revisions) |
| `kubectl rollout undo deployment/nginx-deployment` | Quay trở lại phiên bản trước đó ngay lập tức (Rollback) |

### Tương tác & Dọn dẹp
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl port-forward deployment/nginx-deployment 8080:80` | Forward cổng 8080 của máy tính vào cổng 80 của Deployment (Mở `http://localhost:8080`) |
| `kubectl delete -f 07-deployment/deployment.yaml` | Xoá Deployment (K8s sẽ tự động xoá toàn bộ ReplicaSet và Pod liên quan) |

---

## 5. Kịch bản thực hành từng bước dành cho người mới

### Bước 1: Triển khai Deployment
```bash
kubectl apply -f 07-deployment/deployment.yaml
```
Kiểm tra kết quả:
```bash
kubectl get deployments
kubectl get pods -l app=nginx
```
Bạn sẽ thấy 3 Pod có trạng thái `Running`.

---

### Bước 2: Thử nghiệm tính năng Tự phục hồi (Self-Healing)
1. Liệt kê các Pod để lấy tên 1 Pod:
   ```bash
   kubectl get pods
   ```
2. Thử xoá thủ công 1 Pod:
   ```bash
   kubectl delete pod <tên-1-pod-ở-trên>
   ```
3. Xem lại danh sách ngay lập tức:
   ```bash
   kubectl get pods
   ```
👉 **Hiện tượng:** Bạn sẽ thấy Pod vừa xoá bị `Terminating`, đồng thời có một Pod mới toanh đang được tạo (`ContainerCreating` $\rightarrow$ `Running`) để luôn đảm bảo đủ 3 Pod!

---

### Bước 3: Thử nghiệm Scale (Mở rộng số lượng Pod)
Tăng từ 3 lên 5 Pod:
```bash
kubectl scale deployment nginx-deployment --replicas=5
kubectl get pods
```
Giảm lại về 3 Pod:
```bash
kubectl scale deployment nginx-deployment --replicas=3
kubectl get pods
```

---

### Bước 4: Thử nghiệm truy cập ứng dụng
Chạy port-forward từ terminal:
```bash
kubectl port-forward deployment/nginx-deployment 8080:80
```
Mở trình duyệt truy cập: [http://localhost:8080](http://localhost:8080) để thấy trang chào mừng của Nginx.
Nhấn `Ctrl + C` để dừng port-forward.

---

### Bước 5: Dọn dẹp tài nguyên khi học xong
```bash
kubectl delete -f 07-deployment/deployment.yaml
```
Xác nhận đã dọn sạch:
```bash
kubectl get deployments
kubectl get pods
```
