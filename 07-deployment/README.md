# Kubernetes - Khái niệm Cơ Bản về Deployment & Service

Tài liệu này giải thích chi tiết kiến trúc của **Deployment** và **Service**, cấu trúc manifest `deployment.yaml` và `service.yaml`, mối quan hệ giữa Deployment - ReplicaSet - Pod - Service - Endpoints, bài học thực tế về gỡ lỗi lệch Selector, cùng danh sách các câu lệnh `kubectl` thiết yếu để kiểm tra, gỡ lỗi và vận hành.


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
kubectl delete -f 07-deployment/service.yaml
```
Xác nhận đã dọn sạch:
```bash
kubectl get deployments
kubectl get services
kubectl get pods
```

---

## 6. Service là gì? Tại sao có Deployment rồi vẫn cần Service?

Deployment giúp tạo ra và duy trì 3 Pods Nginx chạy ổn định. Tuy nhiên, trong thực tế bạn sẽ gặp 2 vấn đề lớn:
1. **IP của Pod luôn biến đổi (Ephemeral IP):** Khi 1 Pod bị chết và K8s tự động tạo lại Pod mới (Self-healing), Pod mới sẽ có một địa chỉ IP ngẫu nhiên hoàn toàn mới. Nếu ứng dụng khác gọi thẳng vào IP của Pod, kết nối sẽ bị đứt gãy.
2. **Cân bằng tải (Load Balancing):** Bạn có 3 Pods Nginx, vậy client hoặc frontend bên ngoài gửi request vào địa chỉ nào để chia đều tải cho cả 3 Pod?

👉 **Giải pháp là Kubernetes Service:**
* **Cung cấp một địa chỉ IP ảo cố định (`ClusterIP`):** Không bao giờ thay đổi trong suốt vòng đời của Service.
* **Cung cấp tên miền DNS nội bộ ổn định:** Ví dụ: `http://nginx-service` (các Pod khác chỉ cần gọi qua tên này).
* **Tự động cân bằng tải (Load Balancer nội bộ):** Phân phối ngẫu nhiên các request tới các Pod khỏe mạnh đằng sau.

---

## 7. Cơ chế hoạt động: Service $\rightarrow$ Endpoints / EndpointSlice $\rightarrow$ Pod

Làm thế nào Service biết được phía sau nó có những Pod nào để chuyển tiếp request?

```text
       [ Client / Request ]
                 │
                 ▼
      [ Service: nginx-service ]  (ClusterIP cố định: 192.168.194.213:80)
                 │
            Selector:
            app=nginx
                 │
                 ▼
    [ Endpoints / EndpointSlice ]  (K8s tự động theo dõi và gom danh sách IP của Pod)
      ├── 192.168.194.10:80
      ├── 192.168.194.11:80
      └── 192.168.194.12:80
                 │
         ┌───────┼───────┐  (Cân bằng tải ngẫu nhiên)
         ▼       ▼       ▼
       [Pod 1] [Pod 2] [Pod 3]  (Các Pod mang nhãn app=nginx)
```

1. **Service khai báo `selector`:** Chỉ định điều kiện nhãn (ví dụ `app: nginx`).
2. **Kubernetes Controller tự động tạo `Endpoints` (hoặc `EndpointSlice`):** Quét toàn bộ cluster để tìm các Pod có nhãn khớp với selector. Khi tìm thấy, nó đưa IP:Port của các Pod đó vào danh sách Endpoints.
3. **Khi Pod thay đổi:** Nếu 1 Pod bị xoá và sinh Pod mới với IP mới, K8s tự động cập nhật Endpoints theo thời gian thực mà bạn không cần cấu hình lại Service.

---

## 8. Giải thích cấu hình `service.yaml`

```yaml
apiVersion: v1               # Core API v1
kind: Service                # Loại tài nguyên là Service

metadata:
  name: nginx-service        # Tên Service (cũng là tên DNS nội bộ)

spec:
  type: ClusterIP            # Loại Service: ClusterIP (chỉ truy cập nội bộ trong cụm)

  selector:
    app: nginx               # ⚠️ BẮT BUỘC KHỚP VỚI template.metadata.labels CỦA DEPLOYMENT

  ports:
    - protocol: TCP          # Giao thức TCP
      port: 80               # Cổng của Service (ClusterIP:80)
      targetPort: 80         # Cổng thực tế bên trong container Pod (containerPort của Nginx)
```

### 🔍 Phân biệt rõ `port` vs `targetPort`:
* **`port: 80`**: Cổng mở trên Service (ClusterIP). Người dùng hoặc các dịch vụ khác sẽ gửi request đến cổng này: `http://nginx-service:80`.
* **`targetPort: 80`**: Cổng mà container Nginx bên trong Pod đang lắng nghe (`containerPort: 80`). Service nhận request tại `port` rồi chuyển tiếp (forward) vào `targetPort` của Pod.

---

## 9. Bài học thực tế: Gỡ lỗi lệch Selector (Selector Mismatch)

Một trong những lỗi phổ biến nhất khi làm việc với Kubernetes là **Service không chuyển tiếp được traffic tới Pod**, nguyên nhân 90% là do **lệch Selector**.

### Tình huống giả lập:
* Pod của Deployment có nhãn: `app: nginx`
* Bạn cố tình đổi selector của Service thành: `app: backend`

### 1. Dấu hiệu nhận biết:
Khi chạy các lệnh kiểm tra, bạn sẽ thấy:
```bash
kubectl get endpoints nginx-service
# Kết quả: ENDPOINTS hiển thị <none>

kubectl describe service nginx-service
# Kết quả: Selector: app=backend
#           Endpoints: <none>

kubectl get endpointslices
# Kết quả: ENDPOINTS hiển thị <unset>
```

Khi gửi request thử:
```bash
curl --connect-timeout 3 http://<ClusterIP>
# Kết quả: Connection timed out hoặc Connection refused (vì Service không tìm thấy Pod đích)
```

### 2. Quy trình gỡ lỗi (Troubleshooting workflow):
1. **Kiểm tra nhãn thực tế của Pods đang chạy:**
   ```bash
   kubectl get pods --show-labels
   ```
2. **Kiểm tra xem selector của Service có tìm thấy Pod nào không:**
   ```bash
   kubectl get pods -l app=backend
   # Kết quả: No resources found in default namespace. (Chứng minh selector bị sai!)
   ```
3. **Cách khắc phục:** Sửa lại selector trong `service.yaml` thành `app: nginx` rồi chạy:
   ```bash
   kubectl apply -f 07-deployment/service.yaml
   ```
4. **Xác nhận kết quả:** Chạy lại `kubectl get endpoints nginx-service`, bạn sẽ thấy ngay danh sách IP của cả 3 Pods xuất hiện!

---

## 10. Tổng hợp các câu lệnh `kubectl` với Service

| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl apply -f 07-deployment/service.yaml` | Tạo mới hoặc cập nhật Service từ file YAML |
| `kubectl get services` (hoặc `kubectl get svc`) | Xem danh sách Service, loại (Type) và địa chỉ IP ảo (`ClusterIP`) |
| `kubectl get endpoints nginx-service` | **Kiểm tra kết nối:** Xem danh sách IP của các Pod được nối với Service |
| `kubectl get endpointslices` | Xem tài nguyên EndpointSlice (chuẩn mới thay thế Endpoints từ K8s v1.21+) |
| `kubectl describe service nginx-service` | Xem chi tiết Service, Selector, Port, TargetPort và Endpoints |
| `kubectl port-forward svc/nginx-service 8080:80` | Forward cổng `8080` của máy tính vào cổng `80` của Service |
| `curl http://<ClusterIP>` | Kiểm tra truy cập trực tiếp từ máy Mac (OrbStack hỗ trợ định tuyến ClusterIP) |
| `kubectl delete -f 07-deployment/service.yaml` | Xoá Service (không ảnh hưởng tới các Pod bên dưới) |

