package com.example.blog.book;

/** Thrown by {@link BookService#getFileForDownload} when {@code downloadable == false}. Mapped to 403. */
public class BookNotDownloadableException extends RuntimeException {
    public BookNotDownloadableException() {
        super("Book is not downloadable");
    }
}
