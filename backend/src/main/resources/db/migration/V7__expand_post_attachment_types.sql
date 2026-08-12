-- Align the persistent attachment allowlist with AttachmentType.
ALTER TABLE post_attachments
    DROP CONSTRAINT IF EXISTS post_attachments_attachment_type_check;

ALTER TABLE post_attachments
    ADD CONSTRAINT post_attachments_attachment_type_check
    CHECK (attachment_type IN ('PDF', 'DOC', 'DOCX', 'TXT', 'MD', 'SH', 'SQL', 'ZIP'));
