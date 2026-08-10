package com.example.blog.access;

import com.example.blog.book.Book;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** Join entity: which access groups may read a given (private) book. Mirrors {@link PostAccessGroup}. */
@Entity
@Table(
    name = "book_access_groups",
    uniqueConstraints = @UniqueConstraint(columnNames = {"book_id", "access_group_id"})
)
public class BookAccessGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "access_group_id", nullable = false)
    private AccessGroup accessGroup;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }
    public AccessGroup getAccessGroup() { return accessGroup; }
    public void setAccessGroup(AccessGroup accessGroup) { this.accessGroup = accessGroup; }
}
