package com.example.blog.access;

import com.example.blog.book.Book;
import com.example.blog.book.BookVisibility;
import com.example.blog.user.User;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single chokepoint for "can this user read this book" — mirrors
 * {@link PostAccessService} exactly (same ladder, same denial UX), a
 * deliberate parallel implementation rather than a generic
 * {@code AccessService<T>} — see docs/08-book-library-module.md §2.1 for why.
 * Uses {@link AccessSubjects} for the type-independent half so a future policy
 * change doesn't need a silent third edit.
 */
@Service
public class BookAccessService {

    private final AccessSubjects accessSubjects;
    private final BookAccessGroupRepository bookAccessGroupRepository;
    private final BookUserPermissionRepository bookUserPermissionRepository;

    public BookAccessService(AccessSubjects accessSubjects,
                              BookAccessGroupRepository bookAccessGroupRepository,
                              BookUserPermissionRepository bookUserPermissionRepository) {
        this.accessSubjects = accessSubjects;
        this.bookAccessGroupRepository = bookAccessGroupRepository;
        this.bookUserPermissionRepository = bookUserPermissionRepository;
    }

    public User currentUserOrNull() {
        return accessSubjects.currentUserOrNull();
    }

    /** Plain allow/deny, no reason — for endpoints that should 404 rather than explain (cover-image, file, download). */
    @Transactional(readOnly = true)
    public boolean canRead(User user, Book book) {
        return evaluate(user, book) == null;
    }

    /** Same check, throws with the specific reason — for the book-detail endpoint's richer UX. */
    @Transactional(readOnly = true)
    public void requireRead(User user, Book book) {
        DenialReason reason = evaluate(user, book);
        if (reason != null) {
            throw new BookAccessDeniedException(reason);
        }
    }

    /**
     * Batched version for the library listing: which of these candidate books
     * can `user` fully read? Bounded query count regardless of list size.
     */
    @Transactional(readOnly = true)
    public Set<Long> resolveAccessibleBookIds(User user, List<Book> candidates) {
        Set<Long> accessible = candidates.stream()
                .filter(b -> b.getVisibility() == BookVisibility.PUBLIC)
                .map(Book::getId)
                .collect(Collectors.toCollection(HashSet::new));

        List<Book> privateBooks = candidates.stream()
                .filter(b -> b.getVisibility() == BookVisibility.PRIVATE)
                .toList();
        if (privateBooks.isEmpty() || user == null) {
            return accessible;
        }
        if (accessSubjects.ineligibility(user) != null) {
            return accessible; // PENDING/REJECTED/SUSPENDED: no private access, whatever the role
        }
        if (accessSubjects.hasBypassRole(user)) {
            privateBooks.forEach(b -> accessible.add(b.getId()));
            return accessible;
        }

        List<Long> privateIds = privateBooks.stream().map(Book::getId).toList();

        Set<Long> directIds = bookUserPermissionRepository.findByUserIdAndBookIdIn(user.getId(), privateIds)
                .stream().map(perm -> perm.getBook().getId()).collect(Collectors.toSet());
        accessible.addAll(directIds);

        Set<Long> userGroupIds = accessSubjects.groupIdsOf(user.getId());
        if (!userGroupIds.isEmpty()) {
            bookAccessGroupRepository.findByBookIdIn(privateIds).stream()
                    .filter(bag -> userGroupIds.contains(bag.getAccessGroup().getId()))
                    .map(bag -> bag.getBook().getId())
                    .forEach(accessible::add);
        }
        return accessible;
    }

    // --- internals ---

    private DenialReason evaluate(User user, Book book) {
        if (book.getVisibility() == BookVisibility.PUBLIC) {
            return null;
        }
        DenialReason ineligible = accessSubjects.ineligibility(user);
        if (ineligible != null) {
            return ineligible;
        }
        // ACTIVE from here (user is non-null, guaranteed by ineligibility() returning null only then)
        if (accessSubjects.hasBypassRole(user)) {
            return null;
        }
        if (bookUserPermissionRepository.existsByBookIdAndUserId(book.getId(), user.getId())) {
            return null;
        }
        Set<Long> userGroupIds = accessSubjects.groupIdsOf(user.getId());
        if (!userGroupIds.isEmpty()) {
            boolean inGroup = bookAccessGroupRepository.findByBookId(book.getId()).stream()
                    .anyMatch(bag -> userGroupIds.contains(bag.getAccessGroup().getId()));
            if (inGroup) {
                return null;
            }
        }
        return DenialReason.NO_ACCESS;
    }
}
