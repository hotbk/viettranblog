# Personal Blog AI Claude Project

Repo mẫu để phát triển **web cá nhân dạng blog** bằng:

- Frontend: React + Vite + TypeScript
- Backend: Spring Boot + Java 21 + Spring Data JPA
- Database: PostgreSQL
- AI workflow: Claude Code subagents, skills, project memory, quality gates

## 1. Mục tiêu sản phẩm

Web cá nhân dùng để đăng bài viết về nhiều chủ đề khác nhau: công nghệ, quản trị, dữ liệu, đời sống, ghi chú học tập.

Chức năng ban đầu:

- Xem danh sách bài viết đã publish
- Xem chi tiết bài viết theo slug
- Tìm kiếm bài viết theo từ khóa
- Lọc bài viết theo category
- Tạo / sửa / xóa bài viết qua API backend
- Phân biệt trạng thái `DRAFT` và `PUBLISHED`
- Chuẩn bị sẵn cấu trúc để mở rộng admin dashboard, auth, markdown editor, SEO

## 2. Cấu trúc repo

```text
personal-blog-ai-claude/
├── CLAUDE.md
├── TASKS.md
├── docker-compose.yml
├── docs/
├── .claude/
│   ├── agents/
│   ├── skills/
│   └── settings.json
├── frontend/
└── backend/
```

## 3. Chạy database

```bash
docker compose up -d postgres
```

Database mặc định:

```text
POSTGRES_DB=personal_blog
POSTGRES_USER=blog_user
POSTGRES_PASSWORD=blog_password
```

## 4. Chạy backend

```bash
cd backend
./mvnw spring-boot:run
```

Nếu chưa có Maven wrapper, dùng Maven local:

```bash
mvn spring-boot:run
```

Backend chạy tại:

```text
http://localhost:8080
```

Health check:

```text
GET http://localhost:8080/api/health
```

## 5. Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại:

```text
http://localhost:5173
```

## 6. Dùng Claude Code

Tại thư mục gốc repo:

```bash
claude
```

Ví dụ prompt:

```text
Use architect-agent to review docs/03-architecture.md and propose the next implementation steps. Do not write code yet.
```

```text
Use frontend-agent to implement TASK-FE-001 from TASKS.md. Run lint and typecheck before finishing.
```

```text
Use backend-agent to implement TASK-BE-001 from TASKS.md. Run tests before finishing.
```

## 7. Quy trình phát triển chuẩn

```text
PRD → UI Flow → Architecture → TASKS → Backend → Frontend → QA → Security → PR
```

Không nhảy thẳng vào code nếu chưa có task rõ. Với Claude Code, sai lầm lớn nhất là giao yêu cầu mơ hồ rồi để AI tự suy diễn.

## 8. API mẫu

```text
GET    /api/health
GET    /api/posts
GET    /api/posts/{slug}
POST   /api/posts
PUT    /api/posts/{id}
DELETE /api/posts/{id}
```

## 9. Kiểm tra chất lượng

Frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

Backend:

```bash
cd backend
mvn test
mvn spring-boot:run
```

## 10. Ghi chú quan trọng

Project này cố tình chưa thêm authentication để giữ MVP sạch. Khi mở rộng, nên thêm:

- Spring Security + JWT hoặc session-based auth
- Admin dashboard riêng
- Markdown editor
- Upload ảnh bài viết
- SEO metadata
- Sitemap/RSS
- Comment moderation
