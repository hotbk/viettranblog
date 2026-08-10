export type PostStatus = 'DRAFT' | 'PUBLISHED';

// Access-control axis — independent of PostStatus (editorial workflow above).
export type PostVisibility = 'PUBLIC' | 'PRIVATE';
export type PostMetadataVisibility = 'PUBLIC_METADATA' | 'AUTHORIZED_ONLY';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

// Reason codes the backend returns on a denied private-post read (see PostDetail).
export type AccessDenialCode =
  | 'NOT_AUTHENTICATED'
  | 'ACCOUNT_PENDING'
  | 'ACCOUNT_REJECTED'
  | 'ACCOUNT_SUSPENDED'
  | 'NO_ACCESS';

export interface AccessGroupBrief {
  id: number;
  name: string;
  slug: string;
}

export interface PostBrief {
  id: number;
  title: string;
  slug: string;
}

export interface UserBrief {
  id: number;
  username: string;
  email: string;
}

export interface AccessGroup {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  enabled: boolean;
  userCount: number;
  postCount: number;
  bookCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequest {
  id: number;
  userId: number;
  username: string;
  postId: number;
  postTitle: string;
  message: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: number | null;
}

export interface AuditLogEntry {
  id: number;
  actorUserId: number | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface MeResponse {
  username: string;
  role: 'ADMIN' | 'EDITOR' | 'READER' | 'MEMBER';
  status: UserStatus;
}

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
  visibility: PostVisibility;
  // False only for a locked teaser row (private post, viewer not authorized) —
  // the item still shows (title/excerpt), same as a locked PostCard on the home page.
  accessible: boolean;
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

// Access-control axis — independent of exam status (editorial workflow above),
// same shape/semantics as PostVisibility.
export type ExamVisibility = 'PUBLIC' | 'PRIVATE';

export interface ExamSummary {
  id: number;
  title: string;
  description: string | null;
  timeLimit: number | null;
  scoreScale: number | null;
  passScore: number | null;
  status: string;
  visibility: ExamVisibility;
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
  // Null for a locked teaser row (private post, viewer not authorized,
  // metadata visibility set to show a teaser) — see `accessible` below.
  content: string | null;
  category: string;
  tags: string[];
  status: PostStatus;
  visibility: PostVisibility;
  privateMetadataVisibility: PostMetadataVisibility;
  // False only for a locked teaser in a list response. Always true on the
  // post-detail endpoint — an inaccessible post never reaches the client
  // there, the request fails with a reason-coded 401/403 instead.
  accessible: boolean;
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
  // Admin-listing-only convenience ("3 access groups" badge); absent on public reads.
  accessGroupCount?: number | null;
  // Populated on the detail endpoint and the admin listing; [] on public list cards.
  attachments: PostAttachment[];
}

export type AttachmentType = 'PDF' | 'DOC' | 'DOCX' | 'TXT';

export interface PostAttachment {
  id: number;
  originalFilename: string;
  contentType: string;
  attachmentType: AttachmentType;
  fileSize: number;
  uploadedAt: string;
  url: string;
}

export type BookFileType = 'PDF' | 'TXT';
export type BookStatus = 'DRAFT' | 'PUBLISHED';
export type BookVisibility = 'PUBLIC' | 'PRIVATE';
export type BookMetadataVisibility = 'PUBLIC_METADATA' | 'AUTHORIZED_ONLY';
export type ProgressUnit = 'PAGE' | 'PERCENT';

export interface ReadProgress {
  position: number;
  total: number;
  unit: ProgressUnit;
  percent: number;
  updatedAt: string;
}

export interface Book {
  id: number;
  title: string;
  slug: string;
  author: string | null;
  description: string | null;
  category: string | null;
  fileType: BookFileType;
  contentType: string | null;
  originalFilename: string | null;
  fileSize: number | null;
  hasCoverImage: boolean;
  coverImageUrl: string | null;
  coverImageSize: number | null;
  downloadable: boolean;
  status: BookStatus;
  visibility: BookVisibility;
  // Only meaningful when visibility === 'PRIVATE'. Absent/null on a locked teaser.
  metadataVisibility: BookMetadataVisibility | null;
  // True for a locked teaser row the current viewer can't open — file fields are null then.
  locked: boolean;
  fileUrl: string | null;
  readProgress: ReadProgress | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  // Admin-listing-only convenience; absent on public reads.
  accessGroupCount?: number | null;
}

export interface AboutContent {
  title: string;
  content: string;
  // Null until an admin has saved About content for the first time.
  updatedAt: string | null;
}

// --- Book highlights (Phase 2, docs/09-book-highlights-phase2.md) ---

export type HighlightAnchorType = 'TXT_OFFSET' | 'PDF_RECTS';
export type HighlightColor = 'YELLOW' | 'GREEN' | 'PINK' | 'BLUE';

/** Normalized (0-1) rectangle over a PDF page — see §2.2 of the design doc. */
export interface HighlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BookHighlight {
  id: number;
  bookId: number;
  anchorType: HighlightAnchorType;
  // TXT_OFFSET only
  startOffset: number | null;
  endOffset: number | null;
  // PDF_RECTS only
  pageNumber: number | null;
  rects: HighlightRect[] | null;
  color: HighlightColor;
  text: string;
  note: string | null;
  // True when the book's file was replaced since this highlight was created —
  // the anchor may no longer point at the right place. Computed server-side.
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A row in the cross-book "My Highlights" view — wraps a BookHighlight plus
 * just enough of the parent book to render and deep-link without an extra
 * fetch per row. Mirrors MyBookHighlightResponse (not a flattened shape). */
export interface MyBookHighlight {
  highlight: BookHighlight;
  bookTitle: string;
  bookSlug: string;
  bookFileType: BookFileType;
}

/** Lightweight card for the "related posts" sidebar widget — see fetchRelatedPosts. */
export interface RelatedPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  hasCoverImage: boolean;
  coverImageUrl: string | null;
  publishedAt: string | null;
}
