# Kubernetes - Khái niệm Cơ Bản về ConfigMap

Tài liệu này giải thích chi tiết về **ConfigMap**, nguyên lý tách biệt cấu hình khỏi mã nguồn (12-Factor App), các cách đưa cấu hình vào Pod (biến môi trường vs mount file), kèm theo kịch bản thực hành chi tiết với `configmap.yaml`, `deployment-env.yaml` và `nginx.conf`.

---

## 1. ConfigMap là gì? Tại sao cần ConfigMap?

Theo nguyên tắc **12-Factor App**, bạn **không bao giờ nên hardcode (ghi cứng) cấu hình vào trong Docker image hoặc mã nguồn**.
* Cùng một Docker image, khi chạy ở môi trường **dev** sẽ kết nối tới database dev, port khác.
* Khi lên **staging** hoặc **production**, image đó phải trỏ tới database production mà không cần phải build lại Docker image mới.

👉 **ConfigMap** ra đời để giải quyết bài toán này:
* Lưu trữ các dữ liệu cấu hình dưới dạng **Key - Value** (chuỗi văn bản, file cấu hình, JSON, YAML...).
* Tách rời hoàn toàn vòng đời của **Cấu hình** khỏi **Docker Image** và **Pod**.
* Dễ dàng cập nhật cấu hình cho nhiều Pod cùng lúc.

> ⚠️ **Lưu ý quan trọng:** ConfigMap lưu dữ liệu dạng **văn bản thô (Plaintext)**, không được mã hoá. Đối với thông tin nhạy cảm (mật khẩu, API key, token bí mật), bạn phải dùng **Secret** thay vì ConfigMap.

---

## 2. Giải thích chi tiết các file trong bài thực hành

### 2.1. File `configmap.yaml`
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
data:
  APP_ENV: 'development'
  APP_PORT: '3000'
  API_URL: 'http://backend-service:8080'
  LOG_LEVEL: 'info'
```
* `data`: Chứa danh sách các cặp Key-Value. Mỗi key sẽ trở thành tên biến môi trường hoặc tên file khi được mount.

---

### 2.2. File `deployment-env.yaml` (Nạp qua Biến Môi Trường)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: config-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: config-demo
  template:
    metadata:
      labels:
        app: config-demo
    spec:
      containers:
        - name: app
          image: busybox:1.36
          command: ['sh', '-c']
          args:
            - |
              echo "Application started"
              echo "APP_ENV=$APP_ENV"
              echo "APP_PORT=$APP_PORT"
              echo "API_URL=$API_URL"
              sleep 3600
          envFrom:
            - configMapRef:
                name: backend-config
```
* **`envFrom` $\rightarrow$ `configMapRef`:** Tự động lấy **toàn bộ** các key trong `backend-config` biến thành các biến môi trường tương ứng trong container (`$APP_ENV`, `$APP_PORT`, `$API_URL`, `$LOG_LEVEL`).

---

### 2.3. File `nginx.conf` (Dùng cho cách Mount File qua Volume)
```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
```
* Dùng khi bạn muốn ghi đè cấu hình của Nginx, Redis, MySQL... bằng cách mount file này từ ConfigMap vào thư mục `/etc/nginx/conf.d/default.conf`.

---

## 3. Các cách đưa ConfigMap vào trong Pod

Có 2 cách tiếp cận phổ biến nhất:

```text
               ┌──> Cách 1: Nạp thành Biến Môi Trường (Env Variables)
               │    ├── Cách 1A: Nạp toàn bộ (envFrom)
[ ConfigMap ] ─┤    └── Cách 1B: Nạp từng key lẻ (valueFrom.configMapKeyRef)
               │
               └──> Cách 2: Gắn thành File cấu hình (Volume Mount)
                    └── Mount file trực tiếp vào container (ví dụ: nginx.conf)
```

### Cách 1A: Nạp toàn bộ ConfigMap thành Env (Như file `deployment-env.yaml`)
```yaml
envFrom:
  - configMapRef:
      name: backend-config
```

### Cách 1B: Chỉ chọn lọc một vài biến cụ thể
Nếu ConfigMap có nhiều key nhưng ứng dụng chỉ cần 1 key:
```yaml
env:
  - name: MY_PORT
    valueFrom:
      configMapKeyRef:
        name: backend-config
        key: APP_PORT
```

### Cách 2: Mount ConfigMap thành file (Áp dụng với `nginx.conf`)
Khi bạn cần cung cấp một file cấu hình hoàn chỉnh vào Pod:
```yaml
spec:
  containers:
    - name: nginx
      image: nginx:alpine
      volumeMounts:
        - name: config-volume
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: nginx.conf
  volumes:
    - name: config-volume
      configMap:
        name: nginx-custom-config
```

---

## 4. Kịch bản thực hành từng bước

### Bước 1: Tạo ConfigMap
Tạo ConfigMap từ file manifest:
```bash
kubectl apply -f 11-configmap/configmap.yaml
```
Kiểm tra ConfigMap đã được tạo:
```bash
kubectl get configmaps
kubectl describe configmap backend-config
```

> 💡 **Mẹo:** Bạn cũng có thể tạo nhanh ConfigMap trực tiếp bằng lệnh mà không cần viết file:
> ```bash
> # Tạo từ giá trị trực tiếp:
> kubectl create configmap my-config --from-literal=DB_PORT=5432 --from-literal=DB_HOST=postgres
> 
> # Tạo trực tiếp từ file (ví dụ file nginx.conf có sẵn):
> kubectl create configmap nginx-custom-config --from-file=11-configmap/nginx.conf
> ```

---

### Bước 2: Triển khai Deployment sử dụng ConfigMap
```bash
kubectl apply -f 11-configmap/deployment-env.yaml
```
Kiểm tra Pod đã chạy chưa:
```bash
kubectl get pods -l app=config-demo
```

---

### Bước 3: Kiểm tra xem Pod đã nhận được cấu hình chưa

#### Cách 1: Xem log khởi động của Pod
```bash
kubectl logs -l app=config-demo
```
👉 **Kết quả mong đợi:**
```text
Application started
APP_ENV=development
APP_PORT=3000
API_URL=http://backend-service:8080
```

#### Cách 2: Vào trực tiếp bên trong container kiểm tra biến môi trường
```bash
# Lấy tên Pod:
kubectl get pods -l app=config-demo

# Exec vào Pod chạy lệnh env:
kubectl exec -it <tên-pod> -- env | grep APP_
```
👉 Bạn sẽ thấy các biến `APP_ENV=development` và `APP_PORT=3000` nằm ngay trong container!

---

### Bước 4: Thử nghiệm Cập nhật ConfigMap (Hiện tượng cần nhớ)

1. Mở file `11-configmap/configmap.yaml`, đổi `APP_PORT: '3000'` thành `APP_PORT: '9000'`.
2. Áp dụng lại:
   ```bash
   kubectl apply -f 11-configmap/configmap.yaml
   ```
3. Kiểm tra lại biến môi trường bên trong Pod cũ:
   ```bash
   kubectl exec -it <tên-pod> -- printenv APP_PORT
   ```
👉 **Hiện tượng:** Cổng vẫn là `3000`!  
**Bài học cốt lõi:** Biến môi trường (`env`/`envFrom`) **chỉ được tiêm vào khi Container khởi động**. Khi sửa ConfigMap, các Pod đang chạy **sẽ không tự động nhận biến mới**.  
👉 Để cập nhật, bạn cần khởi động lại Pods bằng lệnh rollout restart:
```bash
kubectl rollout restart deployment config-demo
kubectl logs -l app=config-demo
```
*(Lúc này Pod mới sinh ra sẽ nhận ngay `APP_PORT=9000`)*.

> 📌 **Lưu ý so sánh:** Nếu bạn dùng **Cách 2 (Mount Volume)**, Kubernetes sẽ tự động cập nhật nội dung file bên trong container sau một khoảng thời gian (khoảng vài chục giây đến 1 phút) mà không bắt buộc phải restart Pod!

---

### Bước 5: Dọn dẹp tài nguyên sau khi học xong
```bash
kubectl delete -f 11-configmap/deployment-env.yaml
kubectl delete -f 11-configmap/configmap.yaml
```

Xác nhận lại trạng thái sạch sẽ:
```bash
kubectl get pods
kubectl get configmaps
```

---

## 5. Bảng tra cứu các lệnh `kubectl` với ConfigMap

| Mục đích | Câu lệnh |
| :--- | :--- |
| **Xem danh sách ConfigMap** | `kubectl get configmaps` (hoặc `kubectl get cm`) |
| **Xem chi tiết nội dung dữ liệu** | `kubectl describe configmap <tên-cm>` |
| **Xem định dạng YAML của ConfigMap** | `kubectl get cm <tên-cm> -o yaml` |
| **Tạo ConfigMap từ dòng lệnh (literal)** | `kubectl create cm <tên-cm> --from-literal=KEY=VALUE` |
| **Tạo ConfigMap từ file** | `kubectl create cm <tên-cm> --from-file=<đường-dẫn-file>` |
| **Tạo ConfigMap từ file chứa biến môi trường (.env)** | `kubectl create cm <tên-cm> --from-env-file=.env` |
| **Khởi động lại Pod để nhận ConfigMap mới** | `kubectl rollout restart deployment <tên-deployment>` |
| **Xoá ConfigMap** | `kubectl delete configmap <tên-cm>` |
