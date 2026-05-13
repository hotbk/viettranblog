package com.example.blog.exam;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/member")
public class MemberExamController {

    private final ExamService examService;

    public MemberExamController(ExamService examService) {
        this.examService = examService;
    }

    @GetMapping("/exams")
    public List<ExamSummaryResponse> listExams() {
        return examService.listPublishedExams();
    }

    @GetMapping("/exams/{id}")
    public ExamDetailMemberResponse getExam(@PathVariable Long id) {
        return examService.getExamMember(id);
    }

    @PostMapping("/exams/{examId}/attempts")
    @ResponseStatus(HttpStatus.CREATED)
    public AttemptSummaryResponse startAttempt(@PathVariable Long examId) {
        return examService.startAttempt(examId);
    }

    @PostMapping("/attempts/{attemptId}/submit")
    public AttemptDetailResponse submitAttempt(
            @PathVariable Long attemptId,
            @RequestBody SubmitAttemptRequest req) {
        return examService.submitAttempt(attemptId, req);
    }

    @GetMapping("/attempts")
    public List<AttemptSummaryResponse> myAttempts() {
        return examService.myAttempts();
    }

    @GetMapping("/attempts/{attemptId}")
    public AttemptDetailResponse getAttempt(@PathVariable Long attemptId) {
        return examService.getAttempt(attemptId);
    }
}
