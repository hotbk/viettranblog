package com.example.blog.book;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

/**
 * The book's raw bytes, split from {@link Book} into its own table so a bulk
 * library listing query can never accidentally load them — see
 * docs/08-book-library-module.md §1.2. One row per book (enforced by a unique
 * FK), not a true "file collection"; this MVP is one book = one file.
 */
@Entity
@Table(name = "book_files")
public class BookFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false, unique = true)
    private Book book;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] data;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }
    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }
}
