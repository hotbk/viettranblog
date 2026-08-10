-- Dual-language content (VI/EN) — docs/10-multilingual-content.md §1.5.
--
-- Each language is a full separate row (posts / books), linked by a bare
-- correlation column (translation_group_id), NOT a self-referencing FK and
-- NOT a separate "translation_groups" table. This is a deliberate trade —
-- see docs/10-multilingual-content.md §1.3: deleting one language variant
-- needs no new cleanup path (the group column carries no FK), at the cost of
-- translated_from_id being allowed to dangle after its source is deleted
-- (handled in the application layer by treating a dangling id as NULL).
--
-- DEFAULT 'VI' back-fills every existing post/book as Vietnamese — a product
-- decision (docs/10 §11 question 2), not a technical one: the existing
-- catalogue is Vietnamese.

-- Posts
ALTER TABLE posts ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'VI';
ALTER TABLE posts ADD COLUMN translation_group_id BIGINT;
UPDATE posts SET translation_group_id = id;
ALTER TABLE posts ALTER COLUMN translation_group_id SET NOT NULL;
ALTER TABLE posts ADD COLUMN translated_from_id BIGINT;   -- intentionally NOT a FK, see doc §1.3
ALTER TABLE posts ADD COLUMN source_updated_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN translation_origin VARCHAR(10) NOT NULL DEFAULT 'HUMAN';
CREATE UNIQUE INDEX ux_posts_translation_group_language ON posts (translation_group_id, language);
CREATE INDEX idx_posts_language ON posts (language);

-- Books: identical six columns + two indexes
ALTER TABLE books ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'VI';
ALTER TABLE books ADD COLUMN translation_group_id BIGINT;
UPDATE books SET translation_group_id = id;
ALTER TABLE books ALTER COLUMN translation_group_id SET NOT NULL;
ALTER TABLE books ADD COLUMN translated_from_id BIGINT;
ALTER TABLE books ADD COLUMN source_updated_at TIMESTAMP;
ALTER TABLE books ADD COLUMN translation_origin VARCHAR(10) NOT NULL DEFAULT 'HUMAN';
CREATE UNIQUE INDEX ux_books_translation_group_language ON books (translation_group_id, language);
CREATE INDEX idx_books_language ON books (language);
