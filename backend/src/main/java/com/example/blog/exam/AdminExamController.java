package com.example.blog.exam;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/exams")
public class AdminExamController {

    private final ExamService examService;

    public AdminExamController(ExamService examService) {
        this.examService = examService;
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
}
