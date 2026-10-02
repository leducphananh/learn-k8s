# Kubernetes - Khái niệm Cơ Bản về Pod

Tài liệu này giải thích chi tiết cấu trúc manifest `pod.yaml`, vòng đời của Pod và danh sách các lệnh `kubectl` thiết yếu để làm việc với Pod.

---

## 1. Pod là gì?

* **Đơn vị nhỏ nhất:** Pod là đơn vị triển khai (deployment unit) nhỏ nhất và cơ bản nhất trong Kubernetes.
* **Bao bọc Containers:** Một Pod có thể chứa một hoặc nhiều container (thường là 1 container chính, hoặc kèm thêm sidecar container).
* **Chia sẻ tài nguyên:** Các container trong cùng một Pod sẽ:
  * Dùng chung một địa chỉ IP (giao tiếp với nhau qua `localhost`).
  * Dùng chung ổ đĩa lưu trữ (Volumes).
* **Tính tạm thời (Ephemeral):** Pod không tự chữa lành (self-healing). Nếu một Pod chết hoặc bị xoá, Kubernetes sẽ **không** tự tạo lại một Pod mới thay thế (đó là lý do trong thực tế người ta dùng **Deployment** thay vì tạo Pod đơn lẻ).

---

## 2. Giải thích cấu hình `pod.yaml`

Mọi tài nguyên trong Kubernetes đều bao gồm 4 trường gốc cơ bản:

```yaml
apiVersion: v1          # 1. Phiên bản API của K8s (Pod thuộc core v1)
kind: Pod               # 2. Loại tài nguyên (Pod, Deployment, Service...)

metadata:               # 3. Thông tin định danh của tài nguyên
  name: nginx-pod       # Tên duy nhất của Pod trong một namespace

spec:                   # 4. Đặc tả kỹ thuật (Mong muốn K8s chạy gì)
  containers:
    - name: nginx       # Tên của container bên trong Pod
      image: nginx:alpine # Docker Image tải từ container registry
      ports:
        - containerPort: 80 # Cổng container lắng nghe (chủ yếu mang tính khai báo)
```

---

## 3. Tổng hợp các lệnh `kubectl` với Pod

### Khởi tạo và Quản lý
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl apply -f pod.yaml` | Tạo mới hoặc cập nhật Pod dựa theo khai báo trong file YAML |
| `kubectl run nginx-test --image=nginx:alpine` | Tạo nhanh 1 Pod bằng lệnh trực tiếp (Imperative) mà không cần file YAML |
| `kubectl delete pod nginx-pod` | Xoá Pod theo tên |
| `kubectl delete -f pod.yaml` | Xoá Pod dựa theo cấu hình file YAML |

### Kiểm tra Trạng thái
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl get pods` | Xem danh sách Pod trong namespace hiện tại |
| `kubectl get pod -o wide` | Xem chi tiết IP nội bộ của Pod và tên Node mà Pod đang chạy trên đó |
| `kubectl get pods -w` | Theo dõi trạng thái Pod liên tục theo thời gian thực (Watch mode) |

### Kiểm tra Chi tiết & Gỡ lỗi (Troubleshooting)
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl describe pod nginx-pod` | **Cực kỳ quan trọng:** Xem cấu hình chi tiết và bảng **Events** ở cuối (giúp biết nguyên nhân tại sao Pod bị lỗi `CrashLoopBackOff`, `ImagePullBackOff`...) |
| `kubectl logs nginx-pod` | Xem log đầu ra của ứng dụng trong Pod |
| `kubectl logs -f nginx-pod` | Xem log theo thời gian thực (giống `tail -f`) |

### Truy cập và Tương tác với Pod
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl port-forward pod/nginx-pod 8080:80` | Forward cổng `8080` của máy Mac vào cổng `80` của Pod (Mở trình duyệt vào `http://localhost:8080`) |
| `kubectl exec -it nginx-pod -- sh` | Mở terminal shell tương tác bên trong container của Pod |

---

## 4. Mẹo thử nghiệm trên macOS với OrbStack

Vì bạn đang sử dụng **OrbStack**:
1. **Truy cập IP trực tiếp:** Khác với Minikube hay Docker Desktop thông thường, OrbStack định tuyến mạng trực tiếp từ máy Mac vào Pod. Sau khi chạy `kubectl get pod -o wide` và thấy IP (ví dụ `192.168.194.7`), bạn có thể test ngay trên terminal Mac:
   ```bash
   curl http://192.168.194.7
   ```
2. **Dùng Port Forward:** Nếu muốn an toàn và chuẩn quy trình K8s chung:
   ```bash
   kubectl port-forward pod/nginx-pod 8080:80
   # Truy cập http://localhost:8080 trên trình duyệt
   ```

---

## 5. Các trạng thái (Status) thường gặp của Pod

* **Pending:** Pod đã được K8s chấp nhận nhưng chưa được gán xuống Node hoặc đang tải image về.
* **Running:** Pod đã được gán vào Node và ít nhất một container đang chạy.
* **Succeeded:** Tất cả container trong Pod đã chạy xong và thoát thành công (thường gặp ở Job/CronJob).
* **Failed:** Ít nhất một container thoát với mã lỗi khác 0.
* **CrashLoopBackOff:** Ứng dụng bên trong container bị crash liên tục, K8s đang tự khởi động lại nhưng thất bại.
* **ImagePullBackOff / ErrImagePull:** Sai tên image, tag không tồn tại, hoặc không có quyền pull image riêng tư (private registry).
