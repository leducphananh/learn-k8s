# Kubernetes - Khái niệm Cơ Bản về Secret

Tài liệu này giải thích chi tiết về **Secret**, phân biệt sự khác nhau giữa **Secret** và **ConfigMap**, cơ chế mã hoá Base64, cách phối hợp cả ConfigMap lẫn Secret trong một Deployment, cùng kịch bản thực hành từng bước với `app-config.yaml`, `app-secret.yaml` và `app-deployment.yaml`.

---

## 1. Secret là gì? So sánh Secret vs ConfigMap

Trong bài trước (`11-configmap`), chúng ta đã học cách tách cấu hình ra khỏi Pod. Tuy nhiên, ConfigMap lưu dữ liệu dạng **văn bản thô (Plaintext)**, ai có quyền xem cluster đều đọc được.

👉 **Kubernetes Secret** sinh ra để lưu trữ các **dữ liệu nhạy cảm và bí mật**:
* Mật khẩu cơ sở dữ liệu (Database Password)
* Khóa bí mật, API Keys, OAuth Tokens
* Chứng chỉ bảo mật (SSL/TLS Certificates)
* Thông tin đăng nhập Docker Registry riêng tư (`.dockerconfigjson`)

### Bảng so sánh nhanh:
| Đặc điểm | ConfigMap | Secret |
| :--- | :--- | :--- |
| **Mục đích** | Cấu hình chung, không nhạy cảm | Dữ liệu nhạy cảm, bảo mật |
| **Dữ liệu ví dụ** | `DB_HOST`, `DB_PORT`, `LOG_LEVEL` | `DB_PASSWORD`, `API_KEY`, `JWT_SECRET` |
| **Định dạng hiển thị** | Plaintext đọc được ngay | Mã hoá Base64 khi lưu trữ |
| **Lệnh `kubectl describe`** | Hiện rõ giá trị từng dòng | **Ẩn giá trị**, chỉ hiện số bytes |
| **Giới hạn kích thước** | Tối đa 1MB | Tối đa 1MB |

> ⚠️ **Hiểu lầm kinh điển cần nhớ:**  
> Mặc định trong Kubernetes, Secret được mã hoá dưới dạng **Base64**.  
> **Base64 KHÔNG PHẢI là mã hoá bảo mật (Encryption)** mà chỉ là hình thức làm mờ (Encoding) để tránh đọc vô tình bằng mắt thường. Bất kỳ ai có chuỗi Base64 đều có thể giải mã lại thành văn bản gốc trong 1 giây. Để bảo mật thực sự, các công ty dùng thêm *Encryption at Rest* (mã hoá etcd) hoặc các giải pháp như *HashiCorp Vault*, *AWS Secrets Manager*, *Sealed Secrets*.

---

## 2. Giải thích chi tiết các file trong bài thực hành

### 2.1. File `app-config.yaml` (Cấu hình không nhạy cảm)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: 'production'
  DB_HOST: 'postgres-service'
  DB_PORT: '5432'
```

---

### 2.2. File `app-secret.yaml` (Dữ liệu bí mật)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
stringData:
  DB_USER: 'admin'
  DB_PASSWORD: 'my-secret-password'
```

* **`type: Opaque`**: Loại Secret phổ biến nhất trong K8s (dạng Key-Value tự do). Ngoài ra còn có các loại đặc biệt như `kubernetes.io/tls` (cho chứng chỉ SSL) hay `kubernetes.io/dockerconfigjson` (để kéo image từ private registry).
* **`stringData` vs `data`:**
  * **`stringData` (Khuyên dùng khi viết YAML thủ công):** Bạn nhập văn bản thuần trực tiếp (`'my-secret-password'`). Khi bạn `kubectl apply`, Kubernetes sẽ **tự động chuyển nó thành Base64**.
  * **`data`:** Bắt buộc bạn phải tự encode Base64 trước ở máy tính rồi mới dán vào file (ví dụ: `echo -n 'my-secret-password' | base64` $\rightarrow$ `bXktc2VjcmV0LXBhc3N3b3Jk`).

---

### 2.3. File `app-deployment.yaml` (Phối hợp cả ConfigMap và Secret)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend-app
  template:
    metadata:
      labels:
        app: backend-app
    spec:
      containers:
        - name: backend
          image: busybox:1.36
          command: ['sh', '-c']
          args:
            - |
              echo "Backend starting..."
              echo "Environment: $NODE_ENV"
              echo "Database: $DB_HOST:$DB_PORT"
              echo "Database user: $DB_USER"
              echo "Password is configured"
              sleep 3600
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secret
```

### Mô hình hoạt động:
```text
  [ app-config (ConfigMap) ] ──┐
  (NODE_ENV, DB_HOST, DB_PORT) │
                               ├──> [ Deployment: backend-app ] ──> [ 2 Pods backend ]
  [ app-secret (Secret) ]    ──┘     (envFrom: configMapRef + secretRef)
  (DB_USER, DB_PASSWORD)
```
Deployment sử dụng **`envFrom`** kết hợp cả `configMapRef` lẫn `secretRef`. Ứng dụng bên trong container sẽ nhận được đồng thời cả 5 biến môi trường mà không cần quan tâm biến nào đến từ ConfigMap, biến nào đến từ Secret.

---

## 3. Các cách đưa Secret vào trong Pod

Tương tự như ConfigMap, có 3 cách sử dụng Secret:

### Cách 1: Nạp toàn bộ thành biến môi trường (Như file `app-deployment.yaml`)
```yaml
envFrom:
  - secretRef:
      name: app-secret
```

### Cách 2: Chọn lọc từng khóa riêng lẻ
```yaml
env:
  - name: DATABASE_PASSWORD
    valueFrom:
      secretKeyRef:
        name: app-secret
        key: DB_PASSWORD
```

### Cách 3: Gắn Secret dưới dạng File qua Volume Mount
Rất hữu ích khi ứng dụng yêu cầu đọc file chứng chỉ SSL hoặc file credential:
```yaml
spec:
  containers:
    - name: backend
      image: my-app
      volumeMounts:
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: secret-volume
      secret:
        secretName: app-secret
```
*(Trong thư mục `/etc/secrets/`, K8s sẽ tự tạo 2 file: file `DB_USER` chứa chữ `admin` và file `DB_PASSWORD` chứa mật khẩu)*.

---

## 4. Kịch bản thực hành từng bước

### Bước 1: Khởi tạo ConfigMap và Secret
```bash
kubectl apply -f 12-secret/app-config.yaml
kubectl apply -f 12-secret/app-secret.yaml
```

Kiểm tra danh sách:
```bash
kubectl get configmaps
kubectl get secrets
```

---

### Bước 2: Quan sát cách Kubernetes bảo vệ Secret

1. Dùng lệnh `describe` để xem:
   ```bash
   kubectl describe secret app-secret
   ```
   👉 **Hiện tượng:** Bạn sẽ thấy K8s **không hiển thị mật khẩu**, mà chỉ ghi kích thước:
   ```text
   Data
   ====
   DB_PASSWORD:  18 bytes
   DB_USER:      5 bytes
   ```

2. Xem dạng YAML để thấy chuỗi đã được tự động mã hoá Base64:
   ```bash
   kubectl get secret app-secret -o yaml
   ```
   Bạn sẽ thấy:
   ```yaml
   data:
     DB_PASSWORD: bXktc2VjcmV0LXBhc3N3b3Jk
     DB_USER: YWRtaW4=
   ```

3. Thử giải mã Base64 trên máy tính:
   ```bash
   echo "bXktc2VjcmV0LXBhc3N3b3Jk" | base64 --decode
   # Kết quả trả về đúng: my-secret-password
   ```

---

### Bước 3: Triển khai Deployment
```bash
kubectl apply -f 12-secret/app-deployment.yaml
```

Kiểm tra trạng thái 2 Pod:
```bash
kubectl get pods -l app=backend-app
```

---

### Bước 4: Kiểm tra xem Pod đã nhận được biến môi trường chưa

#### Cách 1: Xem log khởi động của Pod
```bash
kubectl logs -l app=backend-app --tail=20
```
👉 **Kết quả mong đợi:**
```text
Backend starting...
Environment: production
Database: postgres-service:5432
Database user: admin
Password is configured
```

#### Cách 2: Vào trực tiếp Pod kiểm tra
```bash
# Lấy tên của 1 Pod:
POD_NAME=$(kubectl get pods -l app=backend-app -o jsonpath="{.items[0].metadata.name}")

# Kiểm tra biến bí mật bên trong:
kubectl exec -it $POD_NAME -- env | grep DB_
```
👉 Bạn sẽ thấy đầy đủ:
```text
DB_HOST=postgres-service
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=my-secret-password
```

---

### Bước 5: Dọn dẹp tài nguyên sau khi học xong
```bash
kubectl delete -f 12-secret/app-deployment.yaml
kubectl delete -f 12-secret/app-secret.yaml
kubectl delete -f 12-secret/app-config.yaml
```

Xác nhận cluster đã sạch sẽ:
```bash
kubectl get pods
kubectl get secrets
kubectl get configmaps
```

---

## 5. Bảng tra cứu các lệnh `kubectl` với Secret

| Mục đích | Câu lệnh |
| :--- | :--- |
| **Xem danh sách Secret** | `kubectl get secrets` |
| **Xem chi tiết Secret (ẩn giá trị)** | `kubectl describe secret <tên-secret>` |
| **Xem dữ liệu Base64 của Secret** | `kubectl get secret <tên-secret> -o yaml` |
| **Tạo Secret nhanh từ dòng lệnh** | `kubectl create secret generic <tên> --from-literal=DB_PASSWORD=secret123` |
| **Tạo Secret từ file (vd: SSH key)** | `kubectl create secret generic <tên> --from-file=id_rsa=~/.ssh/id_rsa` |
| **Tạo Secret cho chứng chỉ SSL/TLS** | `kubectl create secret tls <tên> --cert=tls.crt --key=tls.key` |
| **Giải mã nhanh 1 giá trị bí mật** | `kubectl get secret <tên> -o jsonpath="{.data.KEY}" \| base64 --decode` |
| **Xoá Secret** | `kubectl delete secret <tên-secret>` |
