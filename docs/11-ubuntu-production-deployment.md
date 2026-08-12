# Build và deploy VietTran Blog lên Ubuntu mới

Tài liệu này là runbook production từ một máy chủ Ubuntu mới hoàn toàn đến khi
website chạy qua HTTPS. Kiến trúc triển khai:

```text
Internet → Nginx :80/:443 → frontend tĩnh
                         └→ /api/* → Spring Boot 127.0.0.1:18080
                                      └→ PostgreSQL Docker 127.0.0.1:5432
```

Hướng dẫn được viết cho Ubuntu Server 24.04 LTS, một domain đã sở hữu và một
server x86_64/arm64 có ít nhất 2 GB RAM, 2 CPU và 20 GB disk. Database chứa cả
ảnh, video, ebook và attachment dưới dạng `bytea`; dung lượng thực tế cần lớn
hơn nhiều nếu upload media thường xuyên.

> Thay mọi giá trị `example.com`, `REPO_URL`, mật khẩu và secret mẫu trước khi
> chạy. Không dùng profile `dev` trên production.

## 1. Chuẩn bị DNS và đăng nhập server

Tại nhà cung cấp DNS, tạo bản ghi:

```text
A     example.com       → PUBLIC_IPV4_CUA_SERVER
AAAA  example.com       → PUBLIC_IPV6_CUA_SERVER   # chỉ tạo nếu server có IPv6
```

Đăng nhập bằng user có quyền `sudo`:

```bash
ssh ubuntu@PUBLIC_IPV4_CUA_SERVER
```

Kiểm tra DNS đã trỏ đúng. Kết quả phải chứa IP của server:

```bash
getent ahosts example.com
```

## 2. Cập nhật Ubuntu và bật firewall

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git nginx ufw ffmpeg openjdk-21-jdk \
  maven rsync openssl
```

Mở SSH trước khi bật firewall để không tự khóa mình khỏi server:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

Chỉ các cổng `22`, `80`, `443` được public. Không mở `5432` hoặc `18080`.

Kiểm tra công cụ:

```bash
java -version
mvn -version
ffmpeg -version
ffprobe -version
nginx -v
```

Ứng dụng cần Java 21. `ffmpeg` và `ffprobe` cần cho upload/transcode video.

## 3. Cài Docker Engine và Compose

Cài từ repository chính thức của Docker:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
```

Không cần thêm user vận hành vào group `docker`; quyền đó gần tương đương root.
Các lệnh Docker trong tài liệu dùng `sudo`.

## 4. Tạo user và thư mục ứng dụng

Backend chạy bằng user hệ thống không có shell đăng nhập:

```bash
sudo useradd --system --home /opt/viettranblog --shell /usr/sbin/nologin blog
sudo install -d -o "$USER" -g "$USER" /opt/viettranblog/source
sudo install -d -o blog -g blog /opt/viettranblog/releases
sudo install -d -o www-data -g www-data /var/www/viettranblog/dist
sudo install -d -m 700 -o root -g root /etc/viettranblog
sudo install -d -m 700 -o root -g root /var/backups/viettranblog
```

Clone source. Nên deploy một tag hoặc commit cụ thể thay vì một branch đang đổi:

```bash
git clone REPO_URL /opt/viettranblog/source
cd /opt/viettranblog/source
git fetch --tags
git checkout TAG_HOAC_COMMIT_CAN_DEPLOY
git rev-parse HEAD
```

Ghi lại commit hash để rollback khi cần.

## 5. Tạo secret production

Sinh hai giá trị ngẫu nhiên độc lập:

```bash
openssl rand -base64 36
openssl rand -base64 48
```

- Kết quả thứ nhất: mật khẩu PostgreSQL.
- Kết quả thứ hai: `JWT_SECRET`.

Tạo `/etc/viettranblog/backend.env`:

```bash
sudoedit /etc/viettranblog/backend.env
```

Nội dung, không đặt khoảng trắng quanh dấu `=`:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/personal_blog
SPRING_DATASOURCE_USERNAME=blog_user
SPRING_DATASOURCE_PASSWORD=THAY_BANG_MAT_KHAU_POSTGRES
JWT_SECRET=THAY_BANG_SECRET_NGAU_NHIEN_TOI_THIEU_32_KY_TU
PUBLIC_BASE_URL=https://example.com
```

Khóa quyền đọc:

```bash
sudo chown root:root /etc/viettranblog/backend.env
sudo chmod 600 /etc/viettranblog/backend.env
```

Không commit file này, không chép secret vào systemd unit và không dùng secret
development mặc định.

## 6. Khởi động PostgreSQL

Tạo `/etc/viettranblog/postgres.env`:

```bash
sudoedit /etc/viettranblog/postgres.env
```

```env
POSTGRES_DB=personal_blog
POSTGRES_USER=blog_user
POSTGRES_PASSWORD=THAY_BANG_CUNG_MAT_KHAU_POSTGRES_O_BUOC_5
```

```bash
sudo chown root:root /etc/viettranblog/postgres.env
sudo chmod 600 /etc/viettranblog/postgres.env
```

Tạo `/etc/viettranblog/compose.yml`:

```bash
sudoedit /etc/viettranblog/compose.yml
```

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: personal-blog-postgres
    env_file:
      - /etc/viettranblog/postgres.env
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - personal-blog-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U blog_user -d personal_blog"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  personal-blog-postgres-data:
    name: personal-blog-postgres-data
```

Khởi động và đợi trạng thái `healthy`:

```bash
sudo docker compose -f /etc/viettranblog/compose.yml pull
sudo docker compose -f /etc/viettranblog/compose.yml up -d
sudo docker compose -f /etc/viettranblog/compose.yml ps
sudo docker logs personal-blog-postgres --tail 50
```

Bind `127.0.0.1:5432` là bắt buộc. Docker-published ports có thể tương tác với
firewall theo cách không trực quan; không dùng `5432:5432` trên production.

## 7. Chạy quality gate và build

### 7.1 Backend

Repo hiện không có Maven wrapper, dùng Maven đã cài trên server:

```bash
cd /opt/viettranblog/source/backend
mvn test
mvn clean package -DskipTests
```

Phải thấy `BUILD SUCCESS`. Artifact:

```bash
ls -lh target/personal-blog-backend-0.1.0.jar
```

### 7.2 Frontend với Node.js 22

Ubuntu có thể không cung cấp đúng Node 22 qua package mặc định. Cài Node.js 22
từ repository NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
less /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
rm -f /tmp/nodesource_setup.sh
sudo apt install -y nodejs
```

Lệnh `less` là điểm dừng để kiểm tra script tải về trước khi chạy bằng root.
Sau đó kiểm tra version:

```bash
node --version
npm --version
```

Kết quả `node --version` phải bắt đầu bằng `v22`. Sau đó:

```bash
cd /opt/viettranblog/source/frontend
npm ci
npm run lint
npm run typecheck
npm run build
```

Build thành công tạo `frontend/dist`. Frontend production gọi API cùng origin
qua `/api`; không cần chạy Vite server và không cần `VITE_BACKEND_URL`.

## 8. Cài artifact theo release

Tạo tên release từ commit:

```bash
cd /opt/viettranblog/source
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
sudo install -d -o blog -g blog "/opt/viettranblog/releases/$RELEASE_ID"
sudo install -o blog -g blog -m 640 \
  backend/target/personal-blog-backend-0.1.0.jar \
  "/opt/viettranblog/releases/$RELEASE_ID/app.jar"
sudo ln -sfn "/opt/viettranblog/releases/$RELEASE_ID" /opt/viettranblog/current

sudo rsync -a --delete frontend/dist/ /var/www/viettranblog/dist/
sudo chown -R www-data:www-data /var/www/viettranblog/dist
```

Không xóa release cũ ngay; giữ ít nhất hai bản gần nhất để rollback backend.

## 9. Tạo systemd service cho backend

Tạo `/etc/systemd/system/viettranblog-backend.service`:

```bash
sudoedit /etc/systemd/system/viettranblog-backend.service
```

```ini
[Unit]
Description=VietTran Blog Backend
Wants=network-online.target
After=network-online.target docker.service
Requires=docker.service

[Service]
Type=simple
User=blog
Group=blog
WorkingDirectory=/opt/viettranblog/current
EnvironmentFile=/etc/viettranblog/backend.env
ExecStart=/usr/bin/java -jar /opt/viettranblog/current/app.jar
Restart=on-failure
RestartSec=5
SuccessExitStatus=143
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Kích hoạt service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now viettranblog-backend
sudo systemctl status viettranblog-backend --no-pager
sudo journalctl -u viettranblog-backend -n 100 --no-pager
```

Khi backend khởi động, Flyway tự chạy các migration chưa áp dụng. Chỉ tiếp tục
nếu log không có lỗi migration/schema và health check trả `200`:

```bash
curl --fail --silent --show-error http://127.0.0.1:18080/api/health
```

## 10. Cấu hình Nginx

Tạo `/etc/nginx/sites-available/viettranblog`:

```bash
sudoedit /etc/nginx/sites-available/viettranblog
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    root /var/www/viettranblog/dist;
    index index.html;

    client_max_body_size 205m;

    location /api/ {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 360s;
        proxy_send_timeout 360s;
    }

    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:18080/api/sitemap.xml;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(?:css|js|mjs|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }
}
```

`client_max_body_size` và timeout cao cần cho video tối đa 200 MB và transcode
đồng bộ. API chỉ proxy nội bộ; không bind backend ra public interface.

Kích hoạt site:

```bash
sudo ln -sfn /etc/nginx/sites-available/viettranblog \
  /etc/nginx/sites-enabled/viettranblog
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Kiểm tra HTTP trước khi xin certificate:

```bash
curl -I http://example.com
curl --fail http://example.com/api/health
```

## 11. Bật HTTPS bằng Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

Chọn redirect toàn bộ HTTP sang HTTPS. Kiểm tra certificate tự gia hạn:

```bash
sudo certbot renew --dry-run
systemctl status certbot.timer --no-pager
curl -I https://example.com
curl --fail https://example.com/api/health
curl --fail https://example.com/sitemap.xml
```

## 12. Tạo admin đầu tiên

Production không chạy `DataSeeder`, không có tài khoản admin mặc định và hiện
chưa có bootstrap/reset-password API. Cần tạo một BCrypt hash rồi insert trực
tiếp. Không dùng profile `dev` để tạo admin.

Sinh hash bằng dependency của project. Tại source backend:

```bash
cd /opt/viettranblog/source/backend
mvn -q dependency:build-classpath -Dmdep.outputFile=/tmp/blog-classpath
jshell --class-path "$(cat /tmp/blog-classpath)" <<'EOF'
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
System.out.println(new BCryptPasswordEncoder().encode("THAY_BANG_MAT_KHAU_ADMIN_MANH"));
/exit
EOF
rm -f /tmp/blog-classpath
```

Copy đúng chuỗi BCrypt vừa in, sau đó mở `psql`:

```bash
sudo docker exec -it personal-blog-postgres \
  psql -U blog_user -d personal_blog
```

Trong `psql`:

```sql
INSERT INTO users
  (username, email, password, role, status, created_at, approved_at)
VALUES
  ('admin', 'admin@example.com', 'DAN_BCRYPT_HASH_VAO_DAY',
   'ADMIN', 'ACTIVE', now(), now());
\q
```

Đăng nhập tại `https://example.com/admin/login`. Lưu mật khẩu trong password
manager. Nếu schema báo thiếu/thừa cột, chạy `\d users` và đối chiếu entity
`backend/src/main/java/com/example/blog/user/User.java` của đúng release trước
khi sửa câu lệnh; không đoán cấu trúc production.

## 13. Backup tự động

Database là nơi duy nhất chứa nội dung và toàn bộ binary upload. Tạo wrapper
đọc cấu hình production:

```bash
sudoedit /usr/local/sbin/viettranblog-backup
```

```bash
#!/usr/bin/env bash
set -euo pipefail
exec env \
  CONTAINER_NAME=personal-blog-postgres \
  DB_NAME=personal_blog \
  DB_USER=blog_user \
  BACKUP_DIR=/var/backups/viettranblog \
  RETENTION_DAYS=14 \
  /opt/viettranblog/source/scripts/backup-postgres.sh
```

```bash
sudo chmod 750 /usr/local/sbin/viettranblog-backup
sudo /usr/local/sbin/viettranblog-backup
sudo ls -lh /var/backups/viettranblog
```

Lên lịch hằng ngày:

```bash
sudo crontab -e
```

```cron
15 2 * * * /usr/local/sbin/viettranblog-backup >> /var/log/viettranblog-backup.log 2>&1
```

Kiểm tra dump mới nhất đọc được:

```bash
LATEST_BACKUP="$(sudo find /var/backups/viettranblog -name '*.dump' -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)"
sudo sh -c "docker exec -i personal-blog-postgres pg_restore --list < '$LATEST_BACKUP' >/dev/null"
```

Backup cùng máy không bảo vệ khỏi hỏng/mất server. Đồng bộ bản backup đã mã hóa
sang storage hoặc máy khác và định kỳ restore thử vào database tạm.

## 14. Checklist go-live

```bash
sudo systemctl is-active docker nginx viettranblog-backend
sudo docker compose -f /etc/viettranblog/compose.yml ps
sudo ss -ltnp
sudo ufw status verbose
curl --fail https://example.com/api/health
curl --fail https://example.com/sitemap.xml
```

- Trang chủ, đăng nhập admin, tạo bài viết và Library hoạt động.
- Upload thử ảnh và một attachment nhỏ.
- Upload video thử để xác nhận `ffmpeg` chạy được dưới user `blog`.
- `PUBLIC_BASE_URL` đúng domain HTTPS.
- `5432` và `18080` không truy cập được từ Internet.
- Backup thủ công đã tạo thành công và cron đã được cấu hình.
- Không có `SPRING_PROFILES_ACTIVE=dev` trong production.

## 15. Deploy bản cập nhật

Luôn backup trước migration:

```bash
sudo /usr/local/sbin/viettranblog-backup
cd /opt/viettranblog/source
git fetch --all --tags
git checkout TAG_HOAC_COMMIT_MOI
```

Chạy lại quality gate và build như mục 7, sau đó cài release mới:

```bash
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
sudo install -d -o blog -g blog "/opt/viettranblog/releases/$RELEASE_ID"
sudo install -o blog -g blog -m 640 \
  backend/target/personal-blog-backend-0.1.0.jar \
  "/opt/viettranblog/releases/$RELEASE_ID/app.jar"
sudo ln -sfn "/opt/viettranblog/releases/$RELEASE_ID" /opt/viettranblog/current
sudo rsync -a --delete frontend/dist/ /var/www/viettranblog/dist/
sudo chown -R www-data:www-data /var/www/viettranblog/dist
sudo systemctl restart viettranblog-backend
```

Xác minh:

```bash
sudo systemctl status viettranblog-backend --no-pager
sudo journalctl -u viettranblog-backend -n 100 --no-pager
curl --fail https://example.com/api/health
```

## 16. Rollback

### Rollback code

Liệt kê release, trỏ symlink về bản trước và restart:

```bash
ls -1dt /opt/viettranblog/releases/*
sudo ln -sfn /opt/viettranblog/releases/RELEASE_TRUOC /opt/viettranblog/current
sudo systemctl restart viettranblog-backend
curl --fail http://127.0.0.1:18080/api/health
```

Frontend cần build/copy lại từ cùng commit cũ; backend và frontend nên luôn cùng
release API contract.

### Cảnh báo rollback database

Đổi JAR không tự hoàn tác Flyway migration. Nếu release mới đã đổi schema theo
cách không tương thích, dừng backend và restore backup đã tạo trước deploy. Đây
là thao tác phá hủy dữ liệu hiện tại; chỉ thực hiện sau khi xác nhận đúng file
backup và giữ lại một dump khẩn cấp của database đang lỗi.

## 17. Chẩn đoán nhanh

Backend không chạy:

```bash
sudo journalctl -u viettranblog-backend -n 200 --no-pager
sudo docker compose -f /etc/viettranblog/compose.yml ps
sudo docker logs personal-blog-postgres --tail 100
```

Nginx trả `502`:

```bash
curl -v http://127.0.0.1:18080/api/health
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
```

Upload bị `413 Request Entity Too Large`: kiểm tra `client_max_body_size 205m`
và reload Nginx. Upload video timeout: kiểm tra `proxy_read_timeout 360s`, log
backend, disk trống và quyền thực thi `ffmpeg`.

Migration lỗi:

```bash
sudo journalctl -u viettranblog-backend -n 200 --no-pager
sudo docker exec -it personal-blog-postgres \
  psql -U blog_user -d personal_blog -c 'SELECT * FROM flyway_schema_history ORDER BY installed_rank;'
```

Không tự sửa hoặc xóa hàng trong `flyway_schema_history` khi chưa hiểu nguyên
nhân. Khôi phục backup hoặc sửa bằng một migration mới đã review.
