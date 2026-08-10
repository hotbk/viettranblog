package com.example.blog.user;

import com.example.blog.book.BookHighlightRepository;
import com.example.blog.common.NotFoundException;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final BookHighlightRepository bookHighlightRepository;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                        BookHighlightRepository bookHighlightRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.bookHighlightRepository = bookHighlightRepository;
    }

    public List<UserResponse> getAll() {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(User::getCreatedAt).reversed())
                .map(UserResponse::from)
                .toList();
    }

    public List<UserResponse> getByStatus(UserStatus status) {
        return userRepository.findByStatus(status).stream()
                .sorted(Comparator.comparing(User::getCreatedAt).reversed())
                .map(UserResponse::from)
                .toList();
    }

    public UserResponse getById(Long id) {
        return UserResponse.from(getEntityById(id));
    }

    /** Admin-created accounts are trusted immediately — an admin vetted them by creating them. */
    public UserResponse create(UserRequest request) {
        User user = buildUser(request.username(), request.email(), request.password(),
                request.role() != null ? request.role() : UserRole.READER, UserStatus.ACTIVE);
        return UserResponse.from(userRepository.save(user));
    }

    /**
     * Public self-registration path — always MEMBER + PENDING, regardless of
     * anything a caller might try to pass. Callers of this method must NOT
     * expose a way to override role/status; that's the whole point of this
     * being a separate method from {@link #create}, which admin-only screens
     * call and which does accept a role.
     */
    public UserResponse registerSelf(String username, String email, String password) {
        User user = buildUser(username, email, password, UserRole.MEMBER, UserStatus.PENDING);
        return UserResponse.from(userRepository.save(user));
    }

    public UserResponse updateRole(Long id, UserRole role) {
        User user = getEntityById(id);
        user.setRole(role);
        return UserResponse.from(userRepository.save(user));
    }

    public UserResponse updateStatus(Long id, UserStatus status, Long actingAdminId) {
        User user = getEntityById(id);
        user.setStatus(status);
        if (status == UserStatus.ACTIVE) {
            user.setApprovedAt(Instant.now());
            user.setApprovedBy(actingAdminId);
        }
        return UserResponse.from(userRepository.save(user));
    }

    /**
     * NOTE: this only cleans up {@code book_highlights} (this service's own
     * addition) — deleting a user who has any {@code book_reading_progress},
     * {@code book_user_permissions}, {@code user_access_groups}, or
     * {@code post_user_permissions} row still 500s on an FK violation today.
     * That's a pre-existing gap (the same FK-cleanup bug class documented for
     * `PostService`/`BookService`), not introduced here — see
     * docs/06-project-memory.md and docs/09-book-highlights-phase2.md §7.2.
     * Filed as a separate follow-up rather than swept into this feature.
     */
    @Transactional
    public void delete(Long id) {
        if (!userRepository.existsById(id)) {
            throw new NotFoundException("USER_NOT_FOUND", "User not found");
        }
        bookHighlightRepository.deleteByUserId(id);
        userRepository.deleteById(id);
    }

    /** Best-effort — used only to stamp `approvedBy`; null if it can't be resolved. */
    public Long currentUserIdOrNull() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        return userRepository.findByUsername(auth.getName()).map(User::getId).orElse(null);
    }

    User getEntityById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));
    }

    private User buildUser(String username, String email, String rawPassword, UserRole role, UserStatus status) {
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("USERNAME_TAKEN");
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("EMAIL_TAKEN");
        }
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole(role);
        user.setStatus(status);
        return user;
    }
}
