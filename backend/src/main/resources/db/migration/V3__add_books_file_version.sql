-- Second piece of the same drift as V2: Book.fileVersion (bumped on file
-- replace, snapshotted onto each highlight — docs/09-book-highlights-phase2.md
-- §2.3) was added to the entity alongside book_highlights, but the backend
-- was never successfully restarted with that code before ddl-auto: update
-- was retired in favor of Flyway, so this column was never created either.
-- V2 is already applied on this database — per this repo's rule (never edit
-- an applied migration), this is a new migration, not an edit to V2.
ALTER TABLE books ADD COLUMN file_version INTEGER NOT NULL DEFAULT 1;
