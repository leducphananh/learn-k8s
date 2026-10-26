# Kubernetes - Khái niệm Cơ Bản về Namespace

Tài liệu này giải thích chi tiết về **Namespace**, cách phân chia môi trường (`dev`, `staging`, `prod`), quy tắc ánh xạ tên (naming convention), cơ chế gán nhãn (labels/selectors) trong manifest, cùng các câu lệnh `kubectl` thiết yếu để làm việc với Namespace.

---

## 1. Namespace là gì? Tại sao cần Namespace?

Trong Kubernetes, **Namespace** giống như các "căn phòng riêng" (virtual cluster) trên cùng một cụm máy chủ vật lý.

### Lợi ích chính của Namespace:
* **Tránh đụng độ tên (Name Isolation):** Hai nhóm làm việc hoặc hai môi trường (`dev` và `prod`) đều có thể đặt tên Service là `web` mà không sợ bị trùng lặp.
* **Tách biệt môi trường:** Phân chia rõ ràng giữa `development`, `staging`, và `production`.
* **Giới hạn tài nguyên (Resource Quotas):** Có thể giới hạn CPU/RAM tối đa cho từng namespace (ví dụ: `dev` tối đa 4 Core CPU, `prod` tối đa 16 Core CPU).
* **Phân quyền truy cập (RBAC):** Cấp quyền cho developer chỉ được can thiệp vào namespace `dev`, không được chạm vào `prod`.

> 📌 **Lưu ý:** Namespace chỉ cô lập về mặt logic và quản lý tài nguyên, mặc định mạng (network) giữa các Namespace vẫn có thể thông nhau trừ khi cấu hình NetworkPolicy để chặn lại.

---

## 2. Quy tắc đặt tên (Name Mapping) trong Deployment & Service

Xem ví dụ trong `09-namespace/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment

metadata:
  name: web              # <-- Tên Deployment
  namespace: dev         # <-- Namespace sở hữu
  labels:
    app: nginx
    env: dev

spec:
  replicas: 2
  ...
  template:
    ...
    spec:
      containers:
        - name: nginx    # <-- Tên Container
          image: nginx:alpine
```

### Cách Kubernetes tự động sinh và map tên:
| Đối tượng | Quy tắc đặt tên | Ví dụ thực tế |
| :--- | :--- | :--- |
| **Deployment** | Lấy từ `metadata.name` | `web` |
| **ReplicaSet** | `<Tên-Deployment>-<Mã-hash-template>` | `web-5499c6768` |
| **Pod** | `<Tên-ReplicaSet>-<Chuỗi-ngẫu-nhiên>` | `web-5499c6768-lrscz`<br>`web-5499c6768-w76vl` |
| **Container** | Lấy từ `spec.template.spec.containers[0].name` | `nginx` |

> 💡 **Trùng tên giữa Deployment và Service:**  
> Trong cùng namespace `dev`, bạn hoàn toàn có thể tạo một Service có `metadata.name: web` đi kèm Deployment `web` vì chúng là hai loại tài nguyên khác nhau (`kind: Service` vs `kind: Deployment`).

---

## 3. Phân biệt 3 vị trí khai báo `labels` trong Deployment

Trong một file manifest Deployment, bạn sẽ thấy `labels` xuất hiện ở 3 vị trí khác nhau:

```yaml
metadata:
  name: web
  namespace: dev
  labels:                  # [1] Nhãn của chính Deployment
    app: nginx
    env: dev

spec:
  selector:
    matchLabels:           # [2] Bộ lọc (kính lúp) để Deployment tìm Pod
      app: nginx
      env: dev

  template:
    metadata:
      labels:              # [3] Nhãn dán lên từng Pod con được sinh ra
        app: nginx
        env: dev
```

### Ý nghĩa từng vị trí:
1. **`[3] template.metadata.labels` (Dán lên Pod con):**  
   Mỗi Pod khi được sinh ra sẽ mang các tem nhãn này.
2. **`[2] spec.selector.matchLabels` (Bộ lọc tìm Pod):**  
   Deployment nhìn vào nhãn này để biết Pod nào thuộc quyền kiểm soát của nó.  
   ⚠️ **Bắt buộc:** Vị trí `[2]` và `[3]` **phải khớp nhau 100%**. Nếu lệch, K8s sẽ báo lỗi và từ chối `apply`.
3. **`[1] metadata.labels` (Dán lên chính Deployment):**  
   Dán tem nhãn lên "người mẹ" Deployment. Dùng để quản trị viên lọc nhanh các tài nguyên (ví dụ: `kubectl get deployment -l env=dev`).  
   *Vị trí này không bắt buộc phải giống `[2]` và `[3]`.*

---

## 4. Tổng hợp các câu lệnh `kubectl` với Namespace

### 1. Quản lý Namespace
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl get namespaces` (hoặc `kubectl get ns`) | Liệt kê tất cả các Namespace trong cụm |
| `kubectl create namespace dev` | Tạo nhanh namespace `dev` |
| `kubectl delete namespace dev` | Xoá namespace `dev` (**Cực kỳ cẩn thận:** Toàn bộ tài nguyên bên trong sẽ bị xoá sạch) |

### 2. Thao tác tài nguyên theo Namespace
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl apply -f deployment.yaml` | Áp dụng tài nguyên (nếu file đã có `namespace: dev` thì tự vào namespace đó) |
| `kubectl get pods -n dev` | Xem danh sách Pod trong namespace `dev` |
| `kubectl get svc -n dev` | Xem danh sách Service trong namespace `dev` |
| `kubectl get all -n dev` | Xem toàn bộ tài nguyên trong namespace `dev` |
| `kubectl get pods -A` (hoặc `--all-namespaces`) | Xem danh sách Pod trên **tất cả** các namespace |

### 3. Tương tác và Gỡ lỗi bên trong Namespace
| Lệnh | Chức năng |
| :--- | :--- |
| `kubectl describe pod <tên-pod> -n dev` | Xem chi tiết cấu hình và Events của Pod trong namespace `dev` |
| `kubectl logs <tên-pod> -n dev` | Xem log của Pod trong namespace `dev` |
| `kubectl exec -it <tên-pod> -n dev -- sh` | **Truy cập terminal vào Pod** trong namespace `dev` |

### 4. Mẹo: Đổi Namespace mặc định của Terminal
Để không phải gõ thêm cờ `-n <namespace>` ở mỗi câu lệnh:

```bash
# Đổi namespace làm việc mặc định sang dev:
kubectl config set-context --current --namespace=dev

# Giờ bạn có thể gõ ngắn gọn:
kubectl get pods
kubectl get svc
kubectl exec -it <tên-pod> -- sh

# Muốn chuyển về lại default:
kubectl config set-context --current --namespace=default
```
