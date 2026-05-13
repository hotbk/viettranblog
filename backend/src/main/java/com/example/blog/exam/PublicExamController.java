package com.example.blog.exam;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
public class PublicExamController {

    private final ExamService examService;

    public PublicExamController(ExamService examService) {
        this.examService = examService;
    }

    @GetMapping
    public List<ExamSummaryResponse> listPublished() {
        return examService.listPublishedExams();
    }
}
