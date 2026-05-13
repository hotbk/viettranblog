# Hướng dẫn triển khai và vận hành — VietTran Blog

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt môi trường phát triển (Development)](#2-cài-đặt-môi-trường-phát-triển-development)
3. [Cấu hình biến môi trường](#3-cấu-hình-biến-môi-trường)
4. [Triển khai production](#4-triển-khai-production)
5. [Vận hành hàng ngày](#5-vận-hành-hàng-ngày)
6. [Xử lý sự cố thường gặp](#6-xử-lý-sự-cố-thường-gặp)
7. [Phụ lục: Thư viện frontend chính](#7-phụ-lục-thư-viện-frontend-chính)

---

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|-----------|-------------------|---------|
| Java (JDK) | 21 | OpenJDK hoặc Oracle JDK |
| Maven | 3.9+ | Hoặc dùng `./mvnw` có sẵn |
| Node.js | 18+ | Khuyến nghị 20 LTS |
| npm | 9+ | Đi kèm Node.js |
| Docker | 24+ | Để chạy PostgreSQL |
| Docker Compose | 2.20+ | Tích hợp sẵn trong Docker Desktop |
| PostgreSQL | 16 | Chạy qua Docker |

---

## 2. Cài đặt môi trường phát triển (Development)

### 2.1 Clone repository

```bash
git clone <repo-url>
cd viettranblog
```

### 2.2 Khởi động database

```bash
docker compose up -d postgres
```

Kiểm tra database đã sẵn sàng:

```bash
docker compose ps
# postgres: healthy
```

### 2.3 Khởi động backend

```bash
cd backend
mvn spring-boot:run
```

Backend sẽ khởi động tại `http://localhost:18080`.

Lần đầu chạy, hệ thống tự seed dữ liệu mẫu:
- User admin: `admin` / `Admin@2024!`
- 4 bài viết mẫu (3 PUBLISHED, 1 DRAFT)
- 5 comment mẫu

### 2.4 Khởi động frontend

Mở terminal mới:

```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy tại **`https://localhost:5173`** (HTTPS, cert tự ký).

> **Lưu ý cert tự ký:** Lần đầu mở trình duyệt sẽ hiện cảnh báo "Not secure" hoặc "Your connection is not private". Chọn **Advanced → Proceed to localhost** (Chrome) hoặc **Accept the Risk** (Firefox) để tiếp tục. Đây là bình thường với cert dev.

Vite tự proxy `/api/*` đến backend `http://localhost:18080`.

Nếu chạy trong máy ảo (VMware, VirtualBox...), frontend đã được cấu hình lắng nghe trên tất cả interface (`0.0.0.0`). Truy cập từ máy host bằng IP của VM:

```
https://<IP-của-VM>:5173
```

Lấy IP của VM:

```bash
hostname -I
# Ví dụ: 192.168.127.12 — dùng IP đầu tiên
```

### 2.5 Kiểm tra hoạt động

| URL | Mô tả |
|-----|-------|
| `https://localhost:5173` | Trang blog công khai |
| `https://localhost:5173/admin/login` | Trang đăng nhập admin |
| `https://localhost:5173/admin/posts` | Quản lý bài viết |
| `https://localhost:5173/admin/users` | Quản lý người dùng |
| `http://localhost:18080/api/health` | Health check backend |

---

## 3. Cấu hình biến môi trường

### 3.1 Backend (`backend/src/main/resources/application.yml`)

Các giá trị mặc định dùng cho development. Production phải override qua biến môi trường:

| Biến môi trường | Mặc định | Mô tả |
|----------------|---------|-------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/personal_blog` | JDBC URL đến PostgreSQL |
| `SPRING_DATASOURCE_USERNAME` | `blog_user` | Username PostgreSQL |
| `SPRING_DATASOURCE_PASSWORD` | `blog_password` | Password PostgreSQL |
| `JWT_SECRET` | `dev-secret-do-not-use-in-production-32chars` | Secret key ký JWT — **bắt buộc đổi trên production** |

Ví dụ chạy với biến môi trường:

```bash
JWT_SECRET=my-super-secret-32-chars-minimum \
SPRING_DATASOURCE_URL=jdbc:postgresql://db-host:5432/personal_blog \
mvn spring-boot:run
```

### 3.2 Frontend (`frontend/.env`)

Tạo file `.env` (không commit vào git):

```env
VITE_API_BASE_URL=/api
```

Trên production, nếu frontend và backend triển khai tách biệt:

```env
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

---

## 4. Triển khai production

### 4.1 Build frontend

```bash
cd frontend
npm install
npm run build
```

Output tại `frontend/dist/` — upload lên web server (Nginx, Caddy, v.v.) hoặc static hosting.

> **Lưu ý:** Plugin `@vitejs/plugin-basic-ssl` chỉ dùng cho dev server, không ảnh hưởng bản build production. Production HTTPS do web server (Nginx + Certbot) xử lý.

### 4.2 Build backend (JAR)

```bash
cd backend
mvn clean package -DskipTests
```

File JAR tại `backend/target/personal-blog-backend-0.1.0.jar`.

Chạy JAR:

```bash
JWT_SECRET=<strong-secret-32-chars> \
SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:5432/personal_blog \
SPRING_DATASOURCE_USERNAME=<user> \
SPRING_DATASOURCE_PASSWORD=<password> \
java -jar target/personal-blog-backend-0.1.0.jar
```

### 4.3 Cấu hình Nginx (ví dụ)

Serve frontend tĩnh và proxy API đến backend:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend tĩnh
    root /var/www/viettranblog/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API đến backend
    location /api/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 4.4 Chạy backend như systemd service

Tạo `/etc/systemd/system/viettranblog.service`:

```ini
[Unit]
Description=VietTran Blog Backend
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/opt/viettranblog
ExecStart=/usr/bin/java -jar /opt/viettranblog/personal-blog-backend-0.1.0.jar
Environment=JWT_SECRET=<strong-secret>
Environment=SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/personal_blog
Environment=SPRING_DATASOURCE_USERNAME=blog_user
Environment=SPRING_DATASOURCE_PASSWORD=<password>
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Kích hoạt:

```bash
sudo systemctl daemon-reload
sudo systemctl enable viettranblog
sudo systemctl start viettranblog
```

### 4.5 Checklist trước khi go-live

- [ ] `JWT_SECRET` là chuỗi ngẫu nhiên mạnh, tối thiểu 32 ký tự
- [ ] Password PostgreSQL đã thay đổi khỏi giá trị mặc định
- [ ] Đổi password user `admin` sau lần đầu đăng nhập
- [ ] HTTPS được bật (Let's Encrypt với Certbot)
- [ ] Cổng 18080 không exposed ra ngoài (chỉ Nginx proxy)
- [ ] Backup database định kỳ (xem phần 5.3)

---

## 5. Vận hành hàng ngày

### 5.1 Khởi động / dừng dịch vụ

**Development:**

```bash
# Khởi động tất cả
docker compose up -d postgres
cd backend && mvn spring-boot:run &
cd frontend && npm run dev &

# Dừng database
docker compose down

# Dừng backend/frontend: Ctrl+C hoặc kill PID
```

**Production (systemd):**

```bash
sudo systemctl start viettranblog
sudo systemctl stop viettranblog
sudo systemctl restart viettranblog
sudo systemctl status viettranblog
```

### 5.2 Xem log

**Backend (development):**

```bash
# Log in-process khi chạy mvn spring-boot:run hiện ra console
# Hoặc nếu chạy nền:
tail -f /tmp/backend.log
```

**Backend (systemd):**

```bash
sudo journalctl -u viettranblog -f
sudo journalctl -u viettranblog --since "1 hour ago"
```

**Database:**

```bash
docker compose logs postgres
docker exec personal-blog-postgres psql -U blog_user -d personal_blog
```

### 5.3 Backup database

Tạo backup:

```bash
docker exec personal-blog-postgres pg_dump \
  -U blog_user personal_blog \
  > backup-$(date +%Y%m%d-%H%M%S).sql
```

Khôi phục từ backup:

```bash
docker exec -i personal-blog-postgres psql \
  -U blog_user personal_blog \
  < backup-20260101-120000.sql
```

### 5.4 Cập nhật ứng dụng

1. Pull code mới: `git pull`
2. Build lại frontend: `cd frontend && npm install && npm run build`
3. Build lại backend: `cd backend && mvn clean package -DskipTests`
4. Restart backend: `sudo systemctl restart viettranblog`
5. Copy `dist/` mới vào web root nếu dùng Nginx

### 5.5 Quản lý người dùng

Đăng nhập admin tại `/admin/login` và truy cập `/admin/users`:

| Hành động | Mô tả |
|-----------|-------|
| Tạo user | Điền form, chọn role: Admin / Editor / Reader |
| Đổi quyền | Dùng dropdown trong bảng, thay đổi áp dụng ngay |
| Xóa user | Nhấn Delete, xác nhận trong dialog |

**Phân quyền:**
- **Admin** — toàn quyền: quản lý bài viết, quản lý người dùng
- **Editor** — quản lý bài viết (tạo, sửa, xóa), không vào trang Users
- **Reader** — không đăng nhập được admin panel

---

## 6. Xử lý sự cố thường gặp

### Backend không khởi động được

**Lỗi:** `Connection refused` khi kết nối PostgreSQL

```bash
# Kiểm tra PostgreSQL đang chạy
docker compose ps

# Nếu chưa chạy
docker compose up -d postgres

# Đợi healthy rồi thử lại
docker compose ps  # Status: healthy
```

**Lỗi:** `Port 18080 already in use`

```bash
# Tìm và kill process đang dùng port
lsof -i :18080
kill -9 <PID>
```

### Frontend không gọi được API

**Triệu chứng:** Lỗi 404 hoặc CORS khi gọi `/api/*`

Kiểm tra Vite proxy trong `frontend/vite.config.ts`: target phải trỏ đúng địa chỉ backend.

Kiểm tra backend đang chạy:

```bash
curl http://localhost:18080/api/health
# Phải trả về: {"status":"ok"}
```

### Không truy cập được từ máy host (VMware / VirtualBox)

**Triệu chứng:** Mở `https://<IP-VM>:5173` từ máy host nhưng không vào được.

Kiểm tra Vite đang bind đúng interface:

```bash
ss -tlnp | grep 5173
# Phải thấy 0.0.0.0:5173, không phải 127.0.0.1:5173
```

Nếu thấy `127.0.0.1`, kiểm tra `frontend/vite.config.ts` có dòng `host: '0.0.0.0'` chưa, sau đó restart Vite.

Kiểm tra firewall trong VM:

```bash
sudo ufw status
# Nếu active, mở port:
sudo ufw allow 5173
sudo ufw allow 18080
```

Kiểm tra network mode của VM: phải là **Bridged** hoặc **NAT with port forwarding**, không phải Host-only nếu muốn truy cập từ ngoài.

### Lỗi 500 khi tạo bài viết

Kiểm tra log backend ngay sau khi lỗi xảy ra:

```bash
tail -50 /tmp/backend.log | grep -E "ERROR|Exception"
```

Lỗi thường gặp: kiểu dữ liệu không khớp với schema DB. Kiểm tra schema:

```bash
docker exec personal-blog-postgres psql -U blog_user -d personal_blog -c "\d posts"
```

### JWT token hết hạn

Token có hiệu lực 24 giờ (cấu hình trong `application.yml`). Khi hết hạn, trình duyệt tự chuyển về trang login. Đăng nhập lại để lấy token mới.

### Quên password admin

Reset trực tiếp qua database (dùng BCrypt hash):

```bash
# Tạo hash cho password mới (ví dụ: NewPass@2024!)
docker exec personal-blog-postgres psql -U blog_user -d personal_blog -c "
UPDATE users
SET password = '\$2a\$10\$ReplaceWithRealBCryptHashHere'
WHERE username = 'admin';
"
```

Cách tạo BCrypt hash: dùng trang online như bcrypt-generator.com (cost factor 10), hoặc thêm một endpoint tạm `/api/auth/reset-password` trong development.

---

## 7. Phụ lục: Thư viện frontend chính

Các thư viện quan trọng được cài thêm ngoài React core — cần biết khi nâng cấp hoặc debug:

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| `@uiw/react-md-editor` | latest | Editor soạn thảo nội dung bài viết (Markdown, toolbar, preview) |
| `react-markdown` | latest | Render nội dung Markdown khi xem bài viết |
| `react-syntax-highlighter` | latest | Syntax highlighting cho code block (SQL, bash, v.v.) trong bài viết |
| `@vitejs/plugin-basic-ssl` | latest | HTTPS tự ký cho Vite dev server — **chỉ dùng ở development** |

> **Lưu ý nội dung bài viết:** Content được lưu dưới dạng Markdown trong database. Khi migrate dữ liệu cũ (plain text), nội dung vẫn hiển thị được nhưng không có định dạng. Code block trong bài viết sử dụng cú pháp ` ```sql ` hoặc ` ```bash ` và tự động được format khi paste vào editor.
