export type PostStatus = 'DRAFT' | 'PUBLISHED';

export interface Comment {
  id: number;
  postId: number;
  authorName: string;
  authorEmail: string | null;
  content: string;
  createdAt: string;
}

export interface SeriesInfo {
  seriesSlug: string;
  seriesTitle: string;
  position: number;
  totalPosts: number;
  prevPostSlug: string | null;
  nextPostSlug: string | null;
}

export interface SeriesPostItem {
  position: number;
  postId: number;
  title: string;
  slug: string;
  excerpt: string;
  status: PostStatus;
  publishedAt: string | null;
}

export interface SeriesSummary {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: PostStatus;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesDetail extends SeriesSummary {
  posts: SeriesPostItem[];
}

// ── Exam types ────────────────────────────────────────────────────────────────

export interface ExamSummary {
  id: number;
  title: string;
  description: string | null;
  timeLimit: number | null;
  scoreScale: number | null;
  passScore: number | null;
  status: string;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OptionAdmin {
  id: number;
  content: string;
  correct: boolean;
  orderIndex: number;
}

export interface OptionMember {
  id: number;
  content: string;
  orderIndex: number;
}

export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT_INPUT';

export interface QuestionAdmin {
  id: number;
  content: string;
  orderIndex: number;
  points: number;
  questionType: QuestionType;
  options: OptionAdmin[];
  correctTextAnswer: string | null;
}

export interface QuestionMember {
  id: number;
  content: string;
  orderIndex: number;
  points: number;
  questionType: QuestionType;
  options: OptionMember[];
}

export interface ExamDetailAdmin extends ExamSummary {
  questions: QuestionAdmin[];
}

export interface ExamDetailMember {
  id: number;
  title: string;
  description: string | null;
  timeLimit: number | null;
  scoreScale: number | null;
  passScore: number | null;
  questionCount: number;
  questions: QuestionMember[];
}

export interface AttemptSummary {
  id: number;
  examId: number;
  examTitle: string;
  score: number | null;
  totalPoints: number | null;
  scaledScore: number | null;
  passed: boolean | null;
  scoreScale: number | null;
  passScore: number | null;
  startedAt: string;
  submittedAt: string | null;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  durationSeconds: number | null;
}

export interface AdminAttemptSummary extends AttemptSummary {
  userId: number;
  username: string;
}

export interface AdminAttemptDetail extends AdminAttemptSummary {
  answers: AnswerResult[];
}

export interface AnswerResult {
  questionId: number;
  questionContent: string;
  questionType: QuestionType;
  selectedOptionIds: number[];
  selectedOptionContents: string[];
  correct: boolean;
  correctOptionIds: number[];
  correctOptionContents: string[];
  textAnswer: string | null;
  correctTextAnswer: string | null;
}

export interface AttemptDetail extends AttemptSummary {
  answers: AnswerResult[];
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  hasCoverImage: boolean;
  coverImageUrl: string | null;
  coverImageOriginalFilename: string | null;
  coverImageContentType: string | null;
  coverImageSize: number | null;
  seriesInfo: SeriesInfo | null;
  viewCount?: number;
}
