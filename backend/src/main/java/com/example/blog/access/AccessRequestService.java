package com.example.blog.access;

import com.example.blog.audit.AuditAction;
import com.example.blog.audit.AuditLogService;
import com.example.blog.common.NotFoundException;
import com.example.blog.notification.NotificationService;
import com.example.blog.post.Post;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostVisibility;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserStatus;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccessRequestService {

    private final AccessRequestRepository accessRequestRepository;
    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final PostAccessService postAccessService;
    private final AccessGroupService accessGroupService;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    public AccessRequestService(AccessRequestRepository accessRequestRepository,
                                 UserRepository userRepository,
                                 PostRepository postRepository,
                                 PostAccessService postAccessService,
                                 AccessGroupService accessGroupService,
                                 AuditLogService auditLogService,
                                 NotificationService notificationService) {
        this.accessRequestRepository = accessRequestRepository;
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.postAccessService = postAccessService;
        this.accessGroupService = accessGroupService;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
    }

    @Transactional
    public AccessRequestResponse create(Long userId, AccessRequestRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));
        // Backend-enforced, not just a hidden frontend button: only an ACTIVE
        // account may request access — a pending/suspended/rejected account
        // needs to resolve that first, not route around it via access requests.
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new IllegalArgumentException("ACCOUNT_NOT_ACTIVE");
        }
        Post post = postRepository.findBySlug(request.postSlug())
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        if (post.getVisibility() != PostVisibility.PRIVATE) {
            throw new IllegalArgumentException("POST_NOT_PRIVATE");
        }
        if (postAccessService.canRead(user, post)) {
            throw new IllegalArgumentException("ALREADY_HAS_ACCESS");
        }
        // Widened to the whole translation group (docs/10-multilingual-content.md
        // §2.4): a member can otherwise open a PENDING request on the VI row and
        // another on the EN row for what is one decision (approval is
        // group-wide anyway, since it grants through the now group-aware
        // AccessGroupService methods).
        List<Long> groupPostIds = postRepository.findByTranslationGroupId(post.getTranslationGroupId()).stream()
                .map(Post::getId)
                .toList();
        boolean alreadyPending = groupPostIds.stream()
                .anyMatch(pid -> accessRequestRepository.existsByUserIdAndPostIdAndStatus(
                        userId, pid, AccessRequestStatus.PENDING));
        if (alreadyPending) {
            throw new IllegalArgumentException("REQUEST_ALREADY_PENDING");
        }

        AccessRequest accessRequest = new AccessRequest();
        accessRequest.setUser(user);
        accessRequest.setPost(post);
        accessRequest.setMessage(request.message());
        return AccessRequestResponse.from(accessRequestRepository.save(accessRequest));
    }

    @Transactional(readOnly = true)
    public List<AccessRequestResponse> listMine(Long userId) {
        return accessRequestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(AccessRequestResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AccessRequestResponse> listByStatus(AccessRequestStatus status) {
        return accessRequestRepository.findByStatusOrderByCreatedAtDesc(status).stream()
                .map(AccessRequestResponse::from)
                .toList();
    }

    @Transactional
    public AccessRequestResponse approve(Long requestId, AccessRequestApproval approval, Long actingAdminId) {
        AccessRequest request = getEntity(requestId);
        if (approval.grantVia() == AccessRequestApproval.GrantVia.GROUP) {
            if (approval.accessGroupId() == null) {
                throw new IllegalArgumentException("ACCESS_GROUP_ID_REQUIRED");
            }
            accessGroupService.addUserToGroup(approval.accessGroupId(), request.getUser().getId(), actingAdminId);
        } else {
            accessGroupService.setPostDirectUsersAdd(request.getPost().getId(), request.getUser().getId(), actingAdminId);
        }
        request.setStatus(AccessRequestStatus.APPROVED);
        request.setReviewedAt(Instant.now());
        request.setReviewedBy(actingAdminId);
        AccessRequest saved = accessRequestRepository.save(request);

        auditLogService.record(actingAdminId, AuditAction.ACCESS_REQUEST_APPROVED,
                "AccessRequest", String.valueOf(requestId),
                "user=" + request.getUser().getUsername() + " post=" + request.getPost().getSlug());
        notificationService.notifyAccessRequestApproved(request.getUser().getId(), request.getPost().getId());
        return AccessRequestResponse.from(saved);
    }

    @Transactional
    public AccessRequestResponse reject(Long requestId, Long actingAdminId) {
        AccessRequest request = getEntity(requestId);
        request.setStatus(AccessRequestStatus.REJECTED);
        request.setReviewedAt(Instant.now());
        request.setReviewedBy(actingAdminId);
        AccessRequest saved = accessRequestRepository.save(request);

        auditLogService.record(actingAdminId, AuditAction.ACCESS_REQUEST_REJECTED,
                "AccessRequest", String.valueOf(requestId),
                "user=" + request.getUser().getUsername() + " post=" + request.getPost().getSlug());
        notificationService.notifyAccessRequestRejected(request.getUser().getId(), request.getPost().getId());
        return AccessRequestResponse.from(saved);
    }

    private AccessRequest getEntity(Long id) {
        return accessRequestRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("ACCESS_REQUEST_NOT_FOUND", "Access request not found"));
    }
}
