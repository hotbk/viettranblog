package com.example.blog.exam;

import com.example.blog.access.AccessGroupBrief;
import com.example.blog.access.AccessGroupService;
import com.example.blog.access.UserBrief;
import com.example.blog.user.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/exams")
public class AdminExamController {

    private final ExamService examService;
    private final AccessGroupService accessGroupService;
    private final UserService userService;

    public AdminExamController(ExamService examService, AccessGroupService accessGroupService,
                                UserService userService) {
        this.examService = examService;
        this.accessGroupService = accessGroupService;
        this.userService = userService;
    }

    @GetMapping
    public List<ExamSummaryResponse> list() {
        return examService.listAllExams();
    }

    @GetMapping("/{id}")
    public ExamDetailAdminResponse get(@PathVariable Long id) {
        return examService.getExamAdmin(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExamDetailAdminResponse create(@RequestBody ExamRequest req) {
        return examService.createExam(req);
    }

    @PutMapping("/{id}")
    public ExamDetailAdminResponse update(@PathVariable Long id, @RequestBody ExamRequest req) {
        return examService.updateExam(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        examService.deleteExam(id);
    }

    @PostMapping("/{examId}/questions")
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionAdminResponse addQuestion(@PathVariable Long examId, @RequestBody QuestionRequest req) {
        return examService.addQuestion(examId, req);
    }

    @PutMapping("/questions/{questionId}")
    public QuestionAdminResponse updateQuestion(@PathVariable Long questionId, @RequestBody QuestionRequest req) {
        return examService.updateQuestion(questionId, req);
    }

    @DeleteMapping("/questions/{questionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteQuestion(@PathVariable Long questionId) {
        examService.deleteQuestion(questionId);
    }

    // --- private-exam access management, surfaced from the exam edit form (mirrors AdminPostController) ---

    @GetMapping("/{id}/access-groups")
    public List<AccessGroupBrief> getAccessGroups(@PathVariable Long id) {
        return accessGroupService.getExamAccessGroups(id);
    }

    @PutMapping("/{id}/access-groups")
    public List<AccessGroupBrief> setAccessGroups(@PathVariable Long id, @RequestBody List<Long> groupIds) {
        accessGroupService.setExamAccessGroups(id, groupIds);
        return accessGroupService.getExamAccessGroups(id);
    }

    @GetMapping("/{id}/access-users")
    public List<UserBrief> getAccessUsers(@PathVariable Long id) {
        return accessGroupService.getExamDirectUsers(id);
    }

    @PutMapping("/{id}/access-users")
    public List<UserBrief> setAccessUsers(@PathVariable Long id, @RequestBody List<Long> userIds) {
        accessGroupService.setExamDirectUsers(id, userIds, userService.currentUserIdOrNull());
        return accessGroupService.getExamDirectUsers(id);
    }
}
