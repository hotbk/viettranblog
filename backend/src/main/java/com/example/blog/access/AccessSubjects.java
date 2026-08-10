package com.example.blog.access;

import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import com.example.blog.user.UserStatus;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The type-independent half of "can this user read this gated thing" —
 * current-user resolution, account-status eligibility, and group membership.
 * Extracted so {@link BookAccessService} doesn't hand-roll a third copy of
 * this logic (the third copy is what actually costs you: {@code PostAccessService}
 * and {@code ExamAccessService} have already drifted on how they treat
 * PENDING/REJECTED/SUSPENDED — see docs/08-book-library-module.md §2.1).
 *
 * {@code PostAccessService}/{@code ExamAccessService} are NOT refactored to use
 * this class as part of this feature — retrofitting them is a separate,
 * test-covered change, not a side effect of adding books.
 */
@Service
public class AccessSubjects {

    private static final Set<UserRole> BYPASS_ROLES = Set.of(UserRole.ADMIN, UserRole.EDITOR);

    private final UserRepository userRepository;
    private final UserAccessGroupRepository userAccessGroupRepository;

    public AccessSubjects(UserRepository userRepository, UserAccessGroupRepository userAccessGroupRepository) {
        this.userRepository = userRepository;
        this.userAccessGroupRepository = userAccessGroupRepository;
    }

    /**
     * Resolves the authenticated DB user for the current request, or null if
     * anonymous. Spring Security's AnonymousAuthenticationFilter still sets a
     * non-null Authentication ("anonymousUser") for unauthenticated requests
     * on permitAll routes — that must NOT be looked up as if it were a real
     * username, or it silently resolves to "no such user" instead of "no user".
     */
    @Transactional(readOnly = true)
    public User currentUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return userRepository.findByUsername(auth.getName()).orElse(null);
    }

    /** Null = eligible to be evaluated further (ACTIVE). Non-null = the specific denial reason, short-circuiting. */
    public DenialReason ineligibility(User user) {
        if (user == null) {
            return DenialReason.NOT_AUTHENTICATED;
        }
        if (user.getStatus() == UserStatus.PENDING) {
            return DenialReason.ACCOUNT_PENDING;
        }
        if (user.getStatus() == UserStatus.REJECTED) {
            return DenialReason.ACCOUNT_REJECTED;
        }
        if (user.getStatus() == UserStatus.SUSPENDED) {
            return DenialReason.ACCOUNT_SUSPENDED;
        }
        return null;
    }

    /** ADMIN/EDITOR already have unrestricted write access to gated content today, so they read everything too. */
    public boolean hasBypassRole(User user) {
        return user != null && BYPASS_ROLES.contains(user.getRole());
    }

    public Set<Long> groupIdsOf(Long userId) {
        return userAccessGroupRepository.findByUserId(userId).stream()
                .map(uag -> uag.getAccessGroup().getId())
                .collect(Collectors.toSet());
    }
}
