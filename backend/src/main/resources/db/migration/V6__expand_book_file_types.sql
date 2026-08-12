-- Keep the database allowlist aligned with BookFileType. Some existing
-- installations have this Hibernate-generated check constraint even though
-- the baseline models file_type as VARCHAR.
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_file_type_check;

ALTER TABLE books
    ADD CONSTRAINT books_file_type_check
    CHECK (file_type IN ('PDF', 'TXT', 'MD', 'SH', 'SQL', 'DOCX'));
