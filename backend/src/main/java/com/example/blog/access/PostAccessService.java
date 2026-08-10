package com.example.blog.access;

import com.example.blog.post.Post;
import com.example.blog.post.PostVisibility;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import com.example.blog.user.UserStatus;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single chokepoint for "can this user read this post" — every place that
 * touches post content (detail, list/search, comments, series, cover-image,
 * view-count) goes through here instead of re-implementing the rule.
 * Default-deny: any branch that isn't an explicit ALLOW falls through to DENY.
 *
 * Security model: PUBLIC posts are always readable. PRIVATE posts require, in
 * order: authenticated -> account not PENDING/REJECTED/SUSPENDED -> (ADMIN or
 * EDITOR bypass, since editors already have unrestricted write access to every
 * post today) OR a direct grant OR group overlap. Status is checked before the
 * role bypass so a suspended admin/editor account still loses read access,
 * even though the spec's authorization matrix doesn't spell out that row.
 */
@Service
public class PostAccessService {

    private static final Set<UserRole> BYPASS_ROLES = Set.of(UserRole.ADMIN, UserRole.EDITOR);

    private final UserRepository userRepository;
    private final UserAccessGroupRepository userAccessGroupRepository;
    private final PostAccessGroupRepository postAccessGroupRepository;
    private final PostUserPermissionRepository postUserPermissionRepository;

    public PostAccessService(UserRepository userRepository,
                              UserAccessGroupRepository userAccessGroupRepository,
                              PostAccessGroupRepository postAccessGroupRepository,
                              PostUserPermissionRepository postUserPermissionRepository) {
        this.userRepository = userRepository;
        this.userAccessGroupRepository = userAccessGroupRepository;
        this.postAccessGroupRepository = postAccessGroupRepository;
        this.postUserPermissionRepository = postUserPermissionRepository;
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

    /** Plain allow/deny, no reason — for endpoints that should 404 rather than explain (comments, cover-image, view). */
    @Transactional(readOnly = true)
    public boolean canRead(User user, Post post) {
        return evaluate(user, post) == null;
    }

    /** Same check, throws with the specific reason — for the post-detail endpoint's richer UX. */
    @Transactional(readOnly = true)
    public void requireRead(User user, Post post) {
        DenialReason reason = evaluate(user, post);
        if (reason != null) {
            throw new PostAccessDeniedException(reason);
        }
    }

    /**
     * Batched version for lists: which of these candidate posts can `user`
     * fully read? Exactly 3 queries total regardless of list size (not one
     * per post) — see plan §D / §G.
     */
    @Transactional(readOnly = true)
    public Set<Long> resolveAccessiblePostIds(User user, List<Post> candidates) {
        Set<Long> accessible = candidates.stream()
                .filter(p -> p.getVisibility() == PostVisibility.PUBLIC)
                .map(Post::getId)
                .collect(Collectors.toCollection(HashSet::new));

        List<Post> privatePosts = candidates.stream()
                .filter(p -> p.getVisibility() == PostVisibility.PRIVATE)
                .toList();
        if (privatePosts.isEmpty() || user == null) {
            return accessible;
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            return accessible; // PENDING/REJECTED/SUSPENDED: no private access, whatever the role
        }
        if (BYPASS_ROLES.contains(user.getRole())) {
            privatePosts.forEach(p -> accessible.add(p.getId()));
            return accessible;
        }

        List<Long> privateIds = privatePosts.stream().map(Post::getId).toList();

        Set<Long> directIds = postUserPermissionRepository.findByUserIdAndPostIdIn(user.getId(), privateIds)
                .stream().map(perm -> perm.getPost().getId()).collect(Collectors.toSet());
        accessible.addAll(directIds);

        Set<Long> userGroupIds = groupIdsOf(user.getId());
        if (!userGroupIds.isEmpty()) {
            postAccessGroupRepository.findByPostIdIn(privateIds).stream()
                    .filter(pag -> userGroupIds.contains(pag.getAccessGroup().getId()))
                    .map(pag -> pag.getPost().getId())
                    .forEach(accessible::add);
        }
        return accessible;
    }

    // --- internals ---

    private DenialReason evaluate(User user, Post post) {
        if (post.getVisibility() == PostVisibility.PUBLIC) {
            return null;
        }
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
        // ACTIVE from here
        if (BYPASS_ROLES.contains(user.getRole())) {
            return null;
        }
        if (postUserPermissionRepository.existsByPostIdAndUserId(post.getId(), user.getId())) {
            return null;
        }
        Set<Long> userGroupIds = groupIdsOf(user.getId());
        if (!userGroupIds.isEmpty()) {
            boolean inGroup = postAccessGroupRepository.findByPostId(post.getId()).stream()
                    .anyMatch(pag -> userGroupIds.contains(pag.getAccessGroup().getId()));
            if (inGroup) {
                return null;
            }
        }
        return DenialReason.NO_ACCESS;
    }

    private Set<Long> groupIdsOf(Long userId) {
        return userAccessGroupRepository.findByUserId(userId).stream()
                .map(uag -> uag.getAccessGroup().getId())
                .collect(Collectors.toSet());
    }
}
