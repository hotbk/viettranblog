package com.example.blog.exam;

import com.example.blog.common.NotFoundException;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ExamService {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamAnswerRepository answerRepository;
    private final UserRepository userRepository;

    public ExamService(ExamRepository examRepository,
                       QuestionRepository questionRepository,
                       ExamAttemptRepository attemptRepository,
                       ExamAnswerRepository answerRepository,
                       UserRepository userRepository) {
        this.examRepository = examRepository;
        this.questionRepository = questionRepository;
        this.attemptRepository = attemptRepository;
        this.answerRepository = answerRepository;
        this.userRepository = userRepository;
    }

    // ── Admin: Exam CRUD ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ExamSummaryResponse> listAllExams() {
        return examRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(ExamSummaryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ExamDetailAdminResponse getExamAdmin(Long id) {
        Exam exam = findExamOrThrow(id);
        return ExamDetailAdminResponse.from(exam);
    }

    @Transactional
    public ExamDetailAdminResponse createExam(ExamRequest req) {
        Exam exam = new Exam();
        applyExamRequest(exam, req);
        examRepository.save(exam);
        return ExamDetailAdminResponse.from(exam);
    }

    @Transactional
    public ExamDetailAdminResponse updateExam(Long id, ExamRequest req) {
        Exam exam = findExamOrThrow(id);
        applyExamRequest(exam, req);
        examRepository.save(exam);
        return ExamDetailAdminResponse.from(exam);
    }

    @Transactional
    public void deleteExam(Long id) {
        if (!examRepository.existsById(id)) {
            throw new NotFoundException("EXAM_NOT_FOUND", "Exam not found");
        }
        examRepository.deleteById(id);
    }

    // ── Admin: Question CRUD ─────────────────────────────────────────────────

    @Transactional
    public QuestionAdminResponse addQuestion(Long examId, QuestionRequest req) {
        Exam exam = findExamOrThrow(examId);
        Question q = buildQuestion(req, exam);
        questionRepository.save(q);
        return QuestionAdminResponse.from(q);
    }

    @Transactional
    public QuestionAdminResponse updateQuestion(Long questionId, QuestionRequest req) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new NotFoundException("QUESTION_NOT_FOUND", "Question not found"));
        q.setContent(req.content());
        q.setOrderIndex(req.orderIndex());
        q.setPoints(req.points());
        q.setQuestionType(parseQuestionType(req.questionType()));
        q.getOptions().clear();
        if (req.options() != null) {
            for (OptionRequest or : req.options()) {
                QuestionOption opt = new QuestionOption();
                opt.setContent(or.content());
                opt.setCorrect(or.correct());
                opt.setOrderIndex(or.orderIndex());
                opt.setQuestion(q);
                q.getOptions().add(opt);
            }
        }
        questionRepository.save(q);
        return QuestionAdminResponse.from(q);
    }

    @Transactional
    public void deleteQuestion(Long questionId) {
        if (!questionRepository.existsById(questionId)) {
            throw new NotFoundException("QUESTION_NOT_FOUND", "Question not found");
        }
        questionRepository.deleteById(questionId);
    }

    // ── Admin: Attempts ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminAttemptSummaryResponse> listAllAttempts(Long examId) {
        List<ExamAttempt> attempts = examId != null
                ? attemptRepository.findByExamIdOrderByStartedAtDesc(examId)
                : attemptRepository.findAllByOrderByStartedAtDesc();
        return attempts.stream().map(AdminAttemptSummaryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public AdminAttemptDetailResponse getAttemptAdmin(Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new NotFoundException("ATTEMPT_NOT_FOUND", "Attempt not found"));
        return AdminAttemptDetailResponse.from(attempt);
    }

    // ── Member: Exams ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ExamSummaryResponse> listPublishedExams() {
        return examRepository.findByStatusOrderByCreatedAtDesc(ExamStatus.PUBLISHED).stream()
                .map(ExamSummaryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ExamDetailMemberResponse getExamMember(Long id) {
        Exam exam = findExamOrThrow(id);
        if (exam.getStatus() != ExamStatus.PUBLISHED) {
            throw new NotFoundException("EXAM_NOT_FOUND", "Exam not found");
        }
        return ExamDetailMemberResponse.from(exam);
    }

    // ── Member: Attempts ─────────────────────────────────────────────────────

    @Transactional
    public AttemptSummaryResponse startAttempt(Long examId) {
        User user = currentUser();
        Exam exam = findExamOrThrow(examId);
        if (exam.getStatus() != ExamStatus.PUBLISHED) {
            throw new NotFoundException("EXAM_NOT_FOUND", "Exam not found");
        }
        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setUser(user);
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attemptRepository.save(attempt);
        return AttemptSummaryResponse.from(attempt);
    }

    @Transactional
    public AttemptDetailResponse submitAttempt(Long attemptId, SubmitAttemptRequest req) {
        User user = currentUser();
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new NotFoundException("ATTEMPT_NOT_FOUND", "Attempt not found"));

        if (!attempt.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Not your attempt");
        }
        if (attempt.getStatus() == AttemptStatus.SUBMITTED) {
            throw new IllegalArgumentException("Attempt already submitted");
        }

        Exam exam = attempt.getExam();

        // Build map: questionId -> list of selected option IDs
        Map<Long, List<Long>> answerMap = req.answers() == null ? Map.of()
                : req.answers().stream()
                        .filter(a -> a.questionId() != null)
                        .collect(Collectors.toMap(
                                SubmitAttemptRequest.AnswerRequest::questionId,
                                a -> a.selectedOptionIds() == null ? List.of() : a.selectedOptionIds(),
                                (a, b) -> a));

        int score = 0;
        int total = 0;
        List<ExamAnswer> answers = new ArrayList<>();

        for (Question q : exam.getQuestions()) {
            total += q.getPoints();
            List<Long> selectedIds = answerMap.getOrDefault(q.getId(), List.of());

            ExamAnswer ea = new ExamAnswer();
            ea.setAttempt(attempt);
            ea.setQuestion(q);

            // Resolve selected options
            List<QuestionOption> selectedOpts = q.getOptions().stream()
                    .filter(o -> selectedIds.contains(o.getId()))
                    .toList();
            ea.setSelectedOptions(new ArrayList<>(selectedOpts));

            // Grade: exact match of correct set
            Set<Long> correctIds = q.getOptions().stream()
                    .filter(o -> Boolean.TRUE.equals(o.getCorrect()))
                    .map(QuestionOption::getId)
                    .collect(Collectors.toSet());
            Set<Long> selectedSet = selectedOpts.stream()
                    .map(QuestionOption::getId)
                    .collect(Collectors.toSet());
            boolean correct = !correctIds.isEmpty() && correctIds.equals(selectedSet);
            ea.setCorrect(correct);
            if (correct) score += q.getPoints();

            answers.add(ea);
        }

        answerRepository.saveAll(answers);
        attempt.getAnswers().addAll(answers);
        attempt.setScore(score);
        attempt.setTotalPoints(total);
        attempt.setSubmittedAt(LocalDateTime.now());
        attempt.setStatus(AttemptStatus.SUBMITTED);
        attemptRepository.save(attempt);

        return AttemptDetailResponse.from(attempt);
    }

    @Transactional(readOnly = true)
    public List<AttemptSummaryResponse> myAttempts() {
        User user = currentUser();
        return attemptRepository.findByUserIdOrderByStartedAtDesc(user.getId()).stream()
                .map(AttemptSummaryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public AttemptDetailResponse getAttempt(Long attemptId) {
        User user = currentUser();
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new NotFoundException("ATTEMPT_NOT_FOUND", "Attempt not found"));
        if (!attempt.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("ATTEMPT_NOT_FOUND", "Attempt not found");
        }
        return AttemptDetailResponse.from(attempt);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Exam findExamOrThrow(Long id) {
        return examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("EXAM_NOT_FOUND", "Exam not found"));
    }

    private User currentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found"));
    }

    private void applyExamRequest(Exam exam, ExamRequest req) {
        exam.setTitle(req.title());
        exam.setDescription(req.description());
        exam.setTimeLimit(req.timeLimit());
        exam.setScoreScale(req.scoreScale());
        exam.setPassScore(req.passScore());
        exam.setStatus(parseStatus(req.status()));
    }

    private ExamStatus parseStatus(String status) {
        try {
            return ExamStatus.valueOf(status);
        } catch (Exception e) {
            return ExamStatus.DRAFT;
        }
    }

    private QuestionType parseQuestionType(String type) {
        try {
            return QuestionType.valueOf(type);
        } catch (Exception e) {
            return QuestionType.SINGLE_CHOICE;
        }
    }

    private Question buildQuestion(QuestionRequest req, Exam exam) {
        Question q = new Question();
        q.setExam(exam);
        q.setContent(req.content());
        q.setOrderIndex(req.orderIndex());
        q.setPoints(req.points() > 0 ? req.points() : 1);
        q.setQuestionType(parseQuestionType(req.questionType()));
        if (req.options() != null) {
            for (OptionRequest or : req.options()) {
                QuestionOption opt = new QuestionOption();
                opt.setContent(or.content());
                opt.setCorrect(or.correct());
                opt.setOrderIndex(or.orderIndex());
                opt.setQuestion(q);
                q.getOptions().add(opt);
            }
        }
        return q;
    }
}
