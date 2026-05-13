package com.example.blog.exam;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/attempts")
public class AdminAttemptController {

    private final ExamService examService;

    public AdminAttemptController(ExamService examService) {
        this.examService = examService;
    }

    @GetMapping
    public List<AdminAttemptSummaryResponse> list(
            @RequestParam(required = false) Long examId) {
        return examService.listAllAttempts(examId);
    }

    @GetMapping("/{id}")
    public AdminAttemptDetailResponse get(@PathVariable Long id) {
        return examService.getAttemptAdmin(id);
    }
}
