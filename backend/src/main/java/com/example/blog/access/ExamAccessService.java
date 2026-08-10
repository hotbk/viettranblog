package com.example.blog.access;

import com.example.blog.exam.Exam;
import com.example.blog.exam.ExamVisibility;
import com.example.blog.user.User;
import com.example.blog.user.UserRole;
import com.example.blog.user.UserStatus;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single chokepoint for "can this member take this exam" — mirrors
 * PostAccessService's model but stays boolean-only (no reason codes): every
 * exam-module denial already reuses the module's existing plain 404
 * ("EXAM_NOT_FOUND") rather than inventing a second denial-UX, since the
 * feature request only needed "assigned users/groups can access it", not the
 * richer PENDING/REJECTED/SUSPENDED messaging the post feature exposes.
 *
 * Default-deny: PUBLIC exams are always readable (unchanged pre-existing
 * behavior — a PUBLISHED exam with no visibility grants set stays open to
 * every member, exactly like before this feature existed). PRIVATE exams
 * require: authenticated -> ACTIVE status -> (ADMIN/EDITOR bypass OR direct
 * grant OR group overlap). In practice `/api/member/**` already requires a
 * MEMBER-role JWT before reaching here, but PENDING/SUSPENDED accounts can
 * still obtain one (see AuthController), so the status check still matters.
 */
@Service
public class ExamAccessService {

    private static final Set<UserRole> BYPASS_ROLES = Set.of(UserRole.ADMIN, UserRole.EDITOR);

    private final UserAccessGroupRepository userAccessGroupRepository;
    private final ExamAccessGroupRepository examAccessGroupRepository;
    private final ExamUserPermissionRepository examUserPermissionRepository;

    public ExamAccessService(UserAccessGroupRepository userAccessGroupRepository,
                              ExamAccessGroupRepository examAccessGroupRepository,
                              ExamUserPermissionRepository examUserPermissionRepository) {
        this.userAccessGroupRepository = userAccessGroupRepository;
        this.examAccessGroupRepository = examAccessGroupRepository;
        this.examUserPermissionRepository = examUserPermissionRepository;
    }

    @Transactional(readOnly = true)
    public boolean canRead(User user, Exam exam) {
        if (exam.getVisibility() == ExamVisibility.PUBLIC) {
            return true;
        }
        if (user == null || user.getStatus() != UserStatus.ACTIVE) {
            return false;
        }
        if (BYPASS_ROLES.contains(user.getRole())) {
            return true;
        }
        if (examUserPermissionRepository.existsByExamIdAndUserId(exam.getId(), user.getId())) {
            return true;
        }
        Set<Long> userGroupIds = groupIdsOf(user.getId());
        if (userGroupIds.isEmpty()) {
            return false;
        }
        return examAccessGroupRepository.findByExamId(exam.getId()).stream()
                .anyMatch(eag -> userGroupIds.contains(eag.getAccessGroup().getId()));
    }

    /**
     * Batched version for the member exam list: which of these candidate
     * exams can `user` take? 3 queries total regardless of list size — same
     * shape as PostAccessService.resolveAccessiblePostIds.
     */
    @Transactional(readOnly = true)
    public Set<Long> resolveAccessibleExamIds(User user, List<Exam> candidates) {
        Set<Long> accessible = candidates.stream()
                .filter(e -> e.getVisibility() == ExamVisibility.PUBLIC)
                .map(Exam::getId)
                .collect(Collectors.toCollection(HashSet::new));

        List<Exam> privateExams = candidates.stream()
                .filter(e -> e.getVisibility() == ExamVisibility.PRIVATE)
                .toList();
        if (privateExams.isEmpty() || user == null || user.getStatus() != UserStatus.ACTIVE) {
            return accessible;
        }
        if (BYPASS_ROLES.contains(user.getRole())) {
            privateExams.forEach(e -> accessible.add(e.getId()));
            return accessible;
        }

        List<Long> privateIds = privateExams.stream().map(Exam::getId).toList();

        Set<Long> directIds = examUserPermissionRepository.findByUserIdAndExamIdIn(user.getId(), privateIds)
                .stream().map(perm -> perm.getExam().getId()).collect(Collectors.toSet());
        accessible.addAll(directIds);

        Set<Long> userGroupIds = groupIdsOf(user.getId());
        if (!userGroupIds.isEmpty()) {
            examAccessGroupRepository.findByExamIdIn(privateIds).stream()
                    .filter(eag -> userGroupIds.contains(eag.getAccessGroup().getId()))
                    .map(eag -> eag.getExam().getId())
                    .forEach(accessible::add);
        }
        return accessible;
    }

    private Set<Long> groupIdsOf(Long userId) {
        return userAccessGroupRepository.findByUserId(userId).stream()
                .map(uag -> uag.getAccessGroup().getId())
                .collect(Collectors.toSet());
    }
}
