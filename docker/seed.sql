-- =============================================================
-- Database seed script — personal_blog
-- Run manually against the database when you need to reset data.
-- Schema is managed by Hibernate (ddl-auto: update).
-- Passwords below are BCrypt hashes of the values shown in comments.
-- =============================================================

-- Truncate in FK-safe order
TRUNCATE TABLE comments RESTART IDENTITY CASCADE;
TRUNCATE TABLE posts    RESTART IDENTITY CASCADE;
TRUNCATE TABLE users    RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------
-- admin       / Admin@2024!   role: ADMIN
-- viet_tran   / Reader@2024!  role: READER
-- minh_nguyen / Reader@2024!  role: READER
-- ---------------------------------------------------------------
INSERT INTO users (username, email, password, role, created_at) VALUES
  ('admin',
   'admin@blog.local',
   '$2a$12$9z1Q6YxRuGRRQqRvpK0jOuwE6.Vz3V0sS7kBKIoK7g0JKqyKwL2aS',
   'ADMIN',
   NOW()),
  ('viet_tran',
   'viet.tran@example.com',
   '$2a$12$DyGg4N3LHfg2Hq6jPbVm7OsQLdA5pS1iH6/kPZRLx8l.kH5nHpjBq',
   'READER',
   NOW()),
  ('minh_nguyen',
   'minh.nguyen@example.com',
   '$2a$12$DyGg4N3LHfg2Hq6jPbVm7OsQLdA5pS1iH6/kPZRLx8l.kH5nHpjBq',
   'READER',
   NOW());

-- ---------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------
INSERT INTO posts (title, slug, excerpt, content, category, tags, status, created_at, updated_at, published_at) VALUES
  (
    'Building a Personal Blog with React and Spring Boot',
    'building-personal-blog-react-spring-boot',
    'A practical note on building a clean full-stack blog MVP.',
    'This article explains the first version of a personal blog built with React for the frontend and Spring Boot for the backend. The goal is not to over-engineer, but to create a maintainable foundation.',
    'Technology',
    'react,spring-boot,fullstack',
    'PUBLISHED',
    NOW(), NOW(), NOW()
  ),
  (
    'Why AI Agents Need Clear Boundaries',
    'why-ai-agents-need-clear-boundaries',
    'A short management note about using AI agents without creating chaos.',
    'AI agents are useful only when their responsibilities are explicit. A frontend agent should not rewrite database logic. A review agent should not silently patch code. Boundaries create quality.',
    'AI Workflow',
    'claude-code,agents,workflow',
    'PUBLISHED',
    NOW(), NOW(), NOW()
  ),
  (
    'Getting Started with PostgreSQL and Spring Data JPA',
    'getting-started-postgresql-spring-data-jpa',
    'A beginner-friendly guide to connecting Spring Boot with PostgreSQL using JPA.',
    'This guide walks through setting up a PostgreSQL database, configuring Spring Data JPA, and writing your first repository. We cover datasource properties, entity mapping, and common pitfalls.',
    'Technology',
    'postgresql,spring-boot,jpa',
    'PUBLISHED',
    NOW(), NOW(), NOW()
  ),
  (
    'Ghi chú về quản lý dự án cá nhân',
    'ghi-chu-quan-ly-du-an-ca-nhan',
    'Những bài học rút ra sau nhiều lần thất bại khi quản lý side project.',
    'Quản lý một dự án cá nhân khác hoàn toàn so với làm việc trong team. Bạn không có deadline cứng, không có ai review code, và rất dễ bỏ cuộc. Bài viết này chia sẻ những nguyên tắc giúp tôi duy trì được tiến độ.',
    'Personal',
    'productivity,side-project,management',
    'DRAFT',
    NOW(), NOW(), NULL
  );

-- ---------------------------------------------------------------
-- Comments
-- post_id=1 → building-personal-blog-react-spring-boot
-- post_id=2 → why-ai-agents-need-clear-boundaries
-- ---------------------------------------------------------------
INSERT INTO comments (post_id, user_id, author_name, author_email, content, created_at) VALUES
  (1, 2, 'viet_tran',    'viet.tran@example.com',  'Bài viết rất hay! Mình đang dùng Spring Boot và React cho dự án của mình, sẽ áp dụng ngay cách tiếp cận này.', NOW()),
  (1, 3, 'minh_nguyen',  'minh.nguyen@example.com', 'Mình tò mò về phần authentication, bạn có thể viết thêm về JWT không?', NOW()),
  (1, NULL, 'Khách vãng lai', NULL,                 'Cảm ơn bài viết, rất hữu ích cho người mới bắt đầu như mình.', NOW()),
  (2, 2, 'viet_tran',    'viet.tran@example.com',  'Hoàn toàn đồng ý. Mình đã từng để AI agent làm mọi thứ và kết quả rất khó kiểm soát.', NOW()),
  (2, NULL, 'An Reader', 'an@example.com',          'Bài viết ngắn gọn nhưng đúng trọng tâm. Cần đọc trước khi dùng Claude Code!', NOW());
