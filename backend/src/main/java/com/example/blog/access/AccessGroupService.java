package com.example.blog.access;

import com.example.blog.audit.AuditAction;
import com.example.blog.audit.AuditLogService;
import com.example.blog.book.Book;
import com.example.blog.book.BookRepository;
import com.example.blog.common.NotFoundException;
import com.example.blog.exam.Exam;
import com.example.blog.exam.ExamRepository;
import com.example.blog.post.Post;
import com.example.blog.post.PostRepository;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns AccessGroup CRUD plus both relationships that hang off it
 * (user<->group, post<->group) and the direct post<->user grant — these are
 * all part of the same admin "who can read what" workflow, so keeping them in
 * one service avoided splitting one relationship's read/write across several
 * files for no real benefit at this scale.
 */
@Service
public class AccessGroupService {

    private final AccessGroupRepository accessGroupRepository;
    private final UserAccessGroupRepository userAccessGroupRepository;
    private final PostAccessGroupRepository postAccessGroupRepository;
    private final PostUserPermissionRepository postUserPermissionRepository;
    private final ExamAccessGroupRepository examAccessGroupRepository;
    private final ExamUserPermissionRepository examUserPermissionRepository;
    private final BookAccessGroupRepository bookAccessGroupRepository;
    private final BookUserPermissionRepository bookUserPermissionRepository;
    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final ExamRepository examRepository;
    private final BookRepository bookRepository;
    private final AuditLogService auditLogService;
    private final UserService userService;

    public AccessGroupService(AccessGroupRepository accessGroupRepository,
                               UserAccessGroupRepository userAccessGroupRepository,
                               PostAccessGroupRepository postAccessGroupRepository,
                               PostUserPermissionRepository postUserPermissionRepository,
                               ExamAccessGroupRepository examAccessGroupRepository,
                               ExamUserPermissionRepository examUserPermissionRepository,
                               BookAccessGroupRepository bookAccessGroupRepository,
                               BookUserPermissionRepository bookUserPermissionRepository,
                               UserRepository userRepository,
                               PostRepository postRepository,
                               ExamRepository examRepository,
                               BookRepository bookRepository,
                               AuditLogService auditLogService,
                               UserService userService) {
        this.accessGroupRepository = accessGroupRepository;
        this.userAccessGroupRepository = userAccessGroupRepository;
        this.postAccessGroupRepository = postAccessGroupRepository;
        this.postUserPermissionRepository = postUserPermissionRepository;
        this.examAccessGroupRepository = examAccessGroupRepository;
        this.examUserPermissionRepository = examUserPermissionRepository;
        this.bookAccessGroupRepository = bookAccessGroupRepository;
        this.bookUserPermissionRepository = bookUserPermissionRepository;
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.examRepository = examRepository;
        this.bookRepository = bookRepository;
        this.auditLogService = auditLogService;
        this.userService = userService;
    }

    // --- group CRUD ---

    @Transactional(readOnly = true)
    public List<AccessGroupResponse> listAll() {
        return accessGroupRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AccessGroupResponse getById(Long id) {
        return toResponse(getEntity(id));
    }

    @Transactional
    public AccessGroupResponse create(AccessGroupRequest request) {
        if (accessGroupRepository.existsBySlug(request.slug().trim())) {
            throw new IllegalArgumentException("Slug already exists");
        }
        AccessGroup group = new AccessGroup();
        apply(group, request);
        AccessGroup saved = accessGroupRepository.save(group);
        auditLogService.record(userService.currentUserIdOrNull(), AuditAction.ACCESS_GROUP_CREATED,
                "AccessGroup", String.valueOf(saved.getId()), saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public AccessGroupResponse update(Long id, AccessGroupRequest request) {
        AccessGroup group = getEntity(id);
        String newSlug = request.slug().trim();
        if (!group.getSlug().equals(newSlug) && accessGroupRepository.existsBySlugAndIdNot(newSlug, id)) {
            throw new IllegalArgumentException("Slug already exists");
        }
        apply(group, request);
        AccessGroup saved = accessGroupRepository.save(group);
        auditLogService.record(userService.currentUserIdOrNull(), AuditAction.ACCESS_GROUP_UPDATED,
                "AccessGroup", String.valueOf(saved.getId()), saved.getName());
        return toResponse(saved);
    }

    @Transactional
    public void delete(Long id) {
        if (!accessGroupRepository.existsById(id)) {
            throw new NotFoundException("ACCESS_GROUP_NOT_FOUND", "Access group not found");
        }
        userAccessGroupRepository.deleteByAccessGroupId(id);
        postAccessGroupRepository.deleteByAccessGroupId(id);
        examAccessGroupRepository.deleteByAccessGroupId(id);
        bookAccessGroupRepository.deleteByAccessGroupId(id);
        accessGroupRepository.deleteById(id);
    }

    // --- user <-> group ---

    @Transactional
    public void addUserToGroup(Long groupId, Long userId, Long actingAdminId) {
        AccessGroup group = getEntity(groupId);
        User user = getUser(userId);
        if (userAccessGroupRepository.existsByUserIdAndAccessGroupId(userId, groupId)) {
            return; // idempotent
        }
        UserAccessGroup uag = new UserAccessGroup();
        uag.setAccessGroup(group);
        uag.setUser(user);
        uag.setGrantedBy(actingAdminId);
        userAccessGroupRepository.save(uag);
        auditLogService.record(actingAdminId, AuditAction.USER_ADDED_TO_GROUP,
                "User", String.valueOf(userId), "group=" + group.getSlug());
    }

    @Transactional
    public void removeUserFromGroup(Long groupId, Long userId, Long actingAdminId) {
        userAccessGroupRepository.deleteByUserIdAndAccessGroupId(userId, groupId);
        auditLogService.record(actingAdminId, AuditAction.USER_REMOVED_FROM_GROUP,
                "User", String.valueOf(userId), "group=" + groupId);
    }

    /** Replace-all: matches the checkbox-list UX on the User Detail admin page (spec §24). */
    @Transactional
    public void setUserAccessGroups(Long userId, List<Long> groupIds, Long actingAdminId) {
        List<UserAccessGroup> existing = userAccessGroupRepository.findByUserId(userId);
        List<Long> desired = groupIds == null ? List.of() : groupIds;
        existing.stream()
                .filter(uag -> !desired.contains(uag.getAccessGroup().getId()))
                .forEach(uag -> userAccessGroupRepository.deleteById(uag.getId()));
        List<Long> already = existing.stream().map(uag -> uag.getAccessGroup().getId()).toList();
        desired.stream()
                .filter(id -> !already.contains(id))
                .forEach(groupId -> addUserToGroup(groupId, userId, actingAdminId));
    }

    @Transactional(readOnly = true)
    public List<AccessGroupBrief> getUserAccessGroups(Long userId) {
        return userAccessGroupRepository.findByUserId(userId).stream()
                .map(uag -> AccessGroupBrief.from(uag.getAccessGroup()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserBrief> getGroupUsers(Long groupId) {
        return userAccessGroupRepository.findByAccessGroupId(groupId).stream()
                .map(uag -> UserBrief.from(uag.getUser()))
                .toList();
    }

    // --- post <-> group (managed from the post edit form: replace-all, same pattern as series post order) ---

    @Transactional
    public void setPostAccessGroups(Long postId, List<Long> groupIds) {
        postAccessGroupRepository.deleteByPostId(postId);
        if (groupIds == null || groupIds.isEmpty()) {
            return;
        }
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        for (Long groupId : groupIds) {
            AccessGroup group = getEntity(groupId);
            PostAccessGroup pag = new PostAccessGroup();
            pag.setPost(post);
            pag.setAccessGroup(group);
            postAccessGroupRepository.save(pag);
        }
    }

    @Transactional(readOnly = true)
    public List<AccessGroupBrief> getPostAccessGroups(Long postId) {
        return postAccessGroupRepository.findByPostId(postId).stream()
                .map(pag -> AccessGroupBrief.from(pag.getAccessGroup()))
                .toList();
    }

    // --- post <-> user direct grant (the "specific users" exception path) ---

    @Transactional
    public void setPostDirectUsers(Long postId, List<Long> userIds, Long actingAdminId) {
        List<PostUserPermission> existing = postUserPermissionRepository.findByPostId(postId);
        existing.forEach(p -> postUserPermissionRepository.deleteById(p.getId()));
        if (userIds == null || userIds.isEmpty()) {
            return;
        }
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        for (Long userId : userIds) {
            User user = getUser(userId);
            PostUserPermission perm = new PostUserPermission();
            perm.setPost(post);
            perm.setUser(user);
            perm.setGrantedBy(actingAdminId);
            postUserPermissionRepository.save(perm);
        }
        auditLogService.record(actingAdminId, AuditAction.POST_PERMISSION_GRANTED,
                "Post", String.valueOf(postId), "users=" + userIds);
    }

    /** Adds one direct grant without disturbing existing ones — used when approving an access request. */
    @Transactional
    public void setPostDirectUsersAdd(Long postId, Long userId, Long actingAdminId) {
        if (postUserPermissionRepository.existsByPostIdAndUserId(postId, userId)) {
            return; // idempotent
        }
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        User user = getUser(userId);
        PostUserPermission perm = new PostUserPermission();
        perm.setPost(post);
        perm.setUser(user);
        perm.setGrantedBy(actingAdminId);
        postUserPermissionRepository.save(perm);
        auditLogService.record(actingAdminId, AuditAction.POST_PERMISSION_GRANTED,
                "Post", String.valueOf(postId), "user=" + userId);
    }

    @Transactional(readOnly = true)
    public List<UserBrief> getPostDirectUsers(Long postId) {
        return postUserPermissionRepository.findByPostId(postId).stream()
                .map(p -> UserBrief.from(p.getUser()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PostBrief> getUserDirectPostAccess(Long userId) {
        return postUserPermissionRepository.findByUserId(userId).stream()
                .map(p -> PostBrief.from(p.getPost()))
                .toList();
    }

    // --- exam <-> group (managed from the exam edit form: replace-all, same pattern as post <-> group) ---

    @Transactional
    public void setExamAccessGroups(Long examId, List<Long> groupIds) {
        examAccessGroupRepository.deleteByExamId(examId);
        if (groupIds == null || groupIds.isEmpty()) {
            return;
        }
        Exam exam = getExam(examId);
        for (Long groupId : groupIds) {
            AccessGroup group = getEntity(groupId);
            ExamAccessGroup eag = new ExamAccessGroup();
            eag.setExam(exam);
            eag.setAccessGroup(group);
            examAccessGroupRepository.save(eag);
        }
    }

    @Transactional(readOnly = true)
    public List<AccessGroupBrief> getExamAccessGroups(Long examId) {
        return examAccessGroupRepository.findByExamId(examId).stream()
                .map(eag -> AccessGroupBrief.from(eag.getAccessGroup()))
                .toList();
    }

    // --- exam <-> user direct grant (the "specific users" exception path) ---

    @Transactional
    public void setExamDirectUsers(Long examId, List<Long> userIds, Long actingAdminId) {
        List<ExamUserPermission> existing = examUserPermissionRepository.findByExamId(examId);
        existing.forEach(p -> examUserPermissionRepository.deleteById(p.getId()));
        if (userIds == null || userIds.isEmpty()) {
            return;
        }
        Exam exam = getExam(examId);
        for (Long userId : userIds) {
            User user = getUser(userId);
            ExamUserPermission perm = new ExamUserPermission();
            perm.setExam(exam);
            perm.setUser(user);
            perm.setGrantedBy(actingAdminId);
            examUserPermissionRepository.save(perm);
        }
        auditLogService.record(actingAdminId, AuditAction.EXAM_PERMISSION_GRANTED,
                "Exam", String.valueOf(examId), "users=" + userIds);
    }

    @Transactional(readOnly = true)
    public List<UserBrief> getExamDirectUsers(Long examId) {
        return examUserPermissionRepository.findByExamId(examId).stream()
                .map(p -> UserBrief.from(p.getUser()))
                .toList();
    }

    // --- book <-> group (managed from the book edit form: replace-all, same pattern as post <-> group) ---

    @Transactional
    public void setBookAccessGroups(Long bookId, List<Long> groupIds) {
        bookAccessGroupRepository.deleteByBookId(bookId);
        if (groupIds == null || groupIds.isEmpty()) {
            return;
        }
        Book book = getBook(bookId);
        for (Long groupId : groupIds) {
            AccessGroup group = getEntity(groupId);
            BookAccessGroup bag = new BookAccessGroup();
            bag.setBook(book);
            bag.setAccessGroup(group);
            bookAccessGroupRepository.save(bag);
        }
    }

    @Transactional(readOnly = true)
    public List<AccessGroupBrief> getBookAccessGroups(Long bookId) {
        return bookAccessGroupRepository.findByBookId(bookId).stream()
                .map(bag -> AccessGroupBrief.from(bag.getAccessGroup()))
                .toList();
    }

    // --- book <-> user direct grant (the "specific users" exception path) ---

    @Transactional
    public void setBookDirectUsers(Long bookId, List<Long> userIds, Long actingAdminId) {
        List<BookUserPermission> existing = bookUserPermissionRepository.findByBookId(bookId);
        existing.forEach(p -> bookUserPermissionRepository.deleteById(p.getId()));
        if (userIds == null || userIds.isEmpty()) {
            return;
        }
        Book book = getBook(bookId);
        for (Long userId : userIds) {
            User user = getUser(userId);
            BookUserPermission perm = new BookUserPermission();
            perm.setBook(book);
            perm.setUser(user);
            perm.setGrantedBy(actingAdminId);
            bookUserPermissionRepository.save(perm);
        }
        auditLogService.record(actingAdminId, AuditAction.BOOK_PERMISSION_GRANTED,
                "Book", String.valueOf(bookId), "users=" + userIds);
    }

    @Transactional(readOnly = true)
    public List<UserBrief> getBookDirectUsers(Long bookId) {
        return bookUserPermissionRepository.findByBookId(bookId).stream()
                .map(p -> UserBrief.from(p.getUser()))
                .toList();
    }

    // --- helpers ---

    private AccessGroup getEntity(Long id) {
        return accessGroupRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("ACCESS_GROUP_NOT_FOUND", "Access group not found"));
    }

    private User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));
    }

    private Exam getExam(Long id) {
        return examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("EXAM_NOT_FOUND", "Exam not found"));
    }

    private Book getBook(Long id) {
        return bookRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
    }

    private static void apply(AccessGroup group, AccessGroupRequest request) {
        group.setName(request.name().trim());
        group.setSlug(request.slug().trim());
        group.setDescription(request.description());
        group.setEnabled(request.enabled());
    }

    private AccessGroupResponse toResponse(AccessGroup group) {
        long userCount = userAccessGroupRepository.countByAccessGroupId(group.getId());
        long postCount = postAccessGroupRepository.countByAccessGroupId(group.getId());
        long examCount = examAccessGroupRepository.countByAccessGroupId(group.getId());
        long bookCount = bookAccessGroupRepository.countByAccessGroupId(group.getId());
        return AccessGroupResponse.from(group, userCount, postCount, examCount, bookCount);
    }
}
