import { authHeader, publicAuthHeader } from './auth';
import { memberAuthHeader } from './memberAuth';
import type {
  BlogPost, Comment, SeriesSummary, SeriesDetail, PostStatus, PostVisibility, PostMetadataVisibility,
  ExamSummary, ExamDetailAdmin, ExamDetailMember, QuestionAdmin, AttemptSummary, AttemptDetail,
  AdminAttemptSummary, AdminAttemptDetail, UserStatus, AccessGroup, AccessGroupBrief, PostBrief, UserBrief,
  AccessRequest, AuditLogEntry, MeResponse, AccessDenialCode, RelatedPost, PostAttachment, AboutContent,
  Book, BookFileType, BookStatus, BookVisibility, BookMetadataVisibility, ReadProgress, ProgressUnit,
  BookHighlight, MyBookHighlight, HighlightAnchorType, HighlightColor, HighlightRect,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class UnauthorizedError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** Thrown by fetchPostBySlug on a 401/403 — carries the backend's reason code so PostDetail can show the right message (see spec §10). */
export class PostAccessDeniedError extends Error {
  code: AccessDenialCode;
  constructor(code: AccessDenialCode) {
    super(`Post access denied: ${code}`);
    this.name = 'PostAccessDeniedError';
    this.code = code;
  }
}

/** Same idea as PostAccessDeniedError, for the book library — see docs/08-book-library-module.md §5.1. */
export class BookAccessDeniedError extends Error {
  code: AccessDenialCode;
  constructor(code: AccessDenialCode) {
    super(`Book access denied: ${code}`);
    this.name = 'BookAccessDeniedError';
    this.code = code;
  }
}

/** Carries the backend's error code for highlight create/update failures (e.g.
 * `HIGHLIGHT_LIMIT_REACHED`, `INVALID_HIGHLIGHT_ANCHOR`) so the UI can branch
 * on it instead of pattern-matching the message string. */
export class HighlightError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'HighlightError';
    this.code = code;
  }
}

export interface PostRequest {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  visibility: PostVisibility;
  privateMetadataVisibility?: PostMetadataVisibility;
}

export type PostResponse = BlogPost;

interface PostQuery {
  q?: string;
  category?: string;
}

export async function fetchPosts(query: PostQuery = {}): Promise<BlogPost[]> {
  const params = new URLSearchParams();

  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);

  const response = await fetch(`${API_BASE_URL}/posts?${params.toString()}`, {
    headers: publicAuthHeader(),
  });

  if (!response.ok) {
    throw new Error('Unable to load posts');
  }

  return response.json();
}

export async function recordPostView(slug: string): Promise<void> {
  await fetch(`${API_BASE_URL}/posts/${slug}/view`, { method: 'POST', headers: publicAuthHeader() });
  // fire-and-forget — ignore errors silently
}

export async function fetchPostBySlug(slug: string): Promise<BlogPost> {
  const response = await fetch(`${API_BASE_URL}/posts/${slug}`, {
    headers: publicAuthHeader(),
  });

  if (response.status === 401 || response.status === 403) {
    const body = await response.json().catch(() => ({}));
    throw new PostAccessDeniedError((body.code as AccessDenialCode) ?? 'NO_ACCESS');
  }

  if (!response.ok) {
    throw new Error('Post not found');
  }

  return response.json();
}

/** Sidebar "related posts" widget on the post-detail page. Returns [] (not an error) when nothing scores as related. */
export async function fetchRelatedPosts(slug: string, limit = 5): Promise<RelatedPost[]> {
  const response = await fetch(`${API_BASE_URL}/posts/${slug}/related?limit=${limit}`, {
    headers: publicAuthHeader(),
  });

  if (!response.ok) {
    throw new Error('Unable to load related posts');
  }

  return response.json();
}

// ── About page ─────────────────────────────────────────────────────────────

export async function fetchAbout(): Promise<AboutContent> {
  const response = await fetch(`${API_BASE_URL}/about`, { headers: publicAuthHeader() });
  if (!response.ok) {
    throw new Error('Unable to load the About page');
  }
  return response.json();
}

export async function fetchAdminAbout(): Promise<AboutContent> {
  const response = await fetch(`${API_BASE_URL}/admin/about`, { headers: authHeader() });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) {
    throw new Error('Unable to load About content');
  }
  return response.json();
}

export async function updateAbout(data: { title: string; content: string }): Promise<AboutContent> {
  const response = await fetch(`${API_BASE_URL}/admin/about`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) {
    throw new Error('Failed to save About content');
  }
  return response.json();
}

export async function fetchAdminPosts(): Promise<BlogPost[]> {
  const response = await fetch(`${API_BASE_URL}/admin/posts`, {
    headers: authHeader(),
  });

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error('Unable to load posts');
  }

  return response.json();
}

export async function createPost(data: PostRequest, coverImage?: File): Promise<PostResponse> {
  const fd = new FormData();
  fd.append('title', data.title);
  fd.append('slug', data.slug);
  fd.append('excerpt', data.excerpt);
  fd.append('content', data.content);
  fd.append('category', data.category);
  fd.append('tags', data.tags.join(','));
  fd.append('status', data.status);
  fd.append('visibility', data.visibility);
  if (data.privateMetadataVisibility) fd.append('privateMetadataVisibility', data.privateMetadataVisibility);
  if (coverImage) fd.append('coverImage', coverImage);

  const response = await fetch(`${API_BASE_URL}/posts`, {
    method: 'POST',
    headers: { ...authHeader() },
    body: fd,
  });

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error('Failed to create post');
  }

  return response.json();
}

export async function updatePost(
  id: number,
  data: PostRequest,
  coverImage?: File,
  removeCoverImage?: boolean,
): Promise<PostResponse> {
  const fd = new FormData();
  fd.append('title', data.title);
  fd.append('slug', data.slug);
  fd.append('excerpt', data.excerpt);
  fd.append('content', data.content);
  fd.append('category', data.category);
  fd.append('tags', data.tags.join(','));
  fd.append('status', data.status);
  fd.append('visibility', data.visibility);
  if (data.privateMetadataVisibility) fd.append('privateMetadataVisibility', data.privateMetadataVisibility);
  fd.append('removeCoverImage', removeCoverImage ? 'true' : 'false');
  if (coverImage) fd.append('coverImage', coverImage);

  const response = await fetch(`${API_BASE_URL}/posts/${id}`, {
    method: 'PUT',
    headers: { ...authHeader() },
    body: fd,
  });

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error('Failed to update post');
  }

  return response.json();
}

export async function updatePostStatus(id: number, status: 'DRAFT' | 'PUBLISHED'): Promise<PostResponse> {
  const response = await fetch(`${API_BASE_URL}/posts/${id}/status?status=${status}`, {
    method: 'PUT',
    headers: { ...authHeader() },
  });

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error('Failed to update post status');
  }

  return response.json();
}

export async function deletePost(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/posts/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  });

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error('Failed to delete post');
  }
}

// ── Comments ─────────────────────────────────────────────────────────────────

export interface CommentRequest {
  authorName: string;
  authorEmail?: string;
  content: string;
}

export async function fetchComments(slug: string): Promise<Comment[]> {
  const response = await fetch(`${API_BASE_URL}/posts/${slug}/comments`, {
    headers: publicAuthHeader(),
  });
  if (!response.ok) throw new Error('Failed to load comments');
  return response.json();
}

export async function submitComment(slug: string, data: CommentRequest): Promise<Comment> {
  const response = await fetch(`${API_BASE_URL}/posts/${slug}/comments`, {
    method: 'POST',
    headers: { ...publicAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? 'Failed to submit comment');
  }
  return response.json();
}

export async function deleteComment(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/comments/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to delete comment');
}

// ── User management ──────────────────────────────────────────────────────────

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'READER' | 'MEMBER';
  status: UserStatus;
  approvedAt: string | null;
  createdAt: string;
}

export interface UserDetailResponseDto extends UserResponse {
  accessGroups: AccessGroupBrief[];
  directPostAccess: PostBrief[];
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'EDITOR' | 'READER' | 'MEMBER';
}

export async function fetchAdminUsers(status?: UserStatus): Promise<UserResponse[]> {
  const params = status ? `?status=${status}` : '';
  const response = await fetch(`${API_BASE_URL}/admin/users${params}`, {
    headers: authHeader(),
  });

  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to load users');

  return response.json();
}

export async function fetchUserDetail(id: number): Promise<UserDetailResponseDto> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, { headers: authHeader() });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('User not found');
  return response.json();
}

export async function updateUserStatus(id: number, status: UserStatus): Promise<UserResponse> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${id}/status?status=${status}`, {
    method: 'PUT',
    headers: authHeader(),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to update status');
  return response.json();
}

export async function updateUserAccessGroups(id: number, groupIds: number[]): Promise<UserDetailResponseDto> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${id}/access-groups`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(groupIds),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to update access groups');
  return response.json();
}

export async function createUser(data: CreateUserRequest): Promise<UserResponse> {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? 'Failed to create user');
  }

  return response.json();
}

export async function updateUserRole(id: number, role: string): Promise<UserResponse> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${id}/role?role=${role}`, {
    method: 'PUT',
    headers: authHeader(),
  });

  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to update role');

  return response.json();
}

export async function deleteUser(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  });

  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to delete user');
}

// ── Series ────────────────────────────────────────────────────────────────────

export interface SeriesRequest {
  title: string;
  slug: string;
  description: string;
  status: PostStatus;
}

export async function fetchSeries(): Promise<SeriesSummary[]> {
  const response = await fetch(`${API_BASE_URL}/series`, { headers: publicAuthHeader() });
  if (!response.ok) throw new Error('Failed to load series');
  return response.json();
}

export async function fetchSeriesBySlug(slug: string): Promise<SeriesDetail> {
  const response = await fetch(`${API_BASE_URL}/series/${slug}`, { headers: publicAuthHeader() });
  if (!response.ok) throw new Error('Series not found');
  return response.json();
}

export async function fetchAdminSeriesList(): Promise<SeriesSummary[]> {
  const response = await fetch(`${API_BASE_URL}/admin/series`, { headers: authHeader() });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to load series');
  return response.json();
}

export async function fetchAdminSeries(id: number): Promise<SeriesDetail> {
  const response = await fetch(`${API_BASE_URL}/admin/series/${id}`, { headers: authHeader() });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Series not found');
  return response.json();
}

export async function createSeries(data: SeriesRequest): Promise<SeriesDetail> {
  const response = await fetch(`${API_BASE_URL}/admin/series`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Failed to create series');
  }
  return response.json();
}

export async function updateSeries(id: number, data: SeriesRequest): Promise<SeriesDetail> {
  const response = await fetch(`${API_BASE_URL}/admin/series/${id}`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Failed to update series');
  }
  return response.json();
}

export async function deleteSeries(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/series/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to delete series');
}

export async function setSeriesPosts(id: number, postIds: number[]): Promise<SeriesDetail> {
  const response = await fetch(`${API_BASE_URL}/admin/series/${id}/posts`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ postIds }),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to update series posts');
  return response.json();
}

// ── Public: Exams ─────────────────────────────────────────────────────────────

export async function fetchPublicExams(): Promise<ExamSummary[]> {
  const res = await fetch(`${API_BASE_URL}/exams`);
  if (!res.ok) throw new Error('Failed to load exams');
  return res.json();
}

// ── Admin: Exam management ────────────────────────────────────────────────────

export interface ExamRequest {
  title: string;
  description: string;
  timeLimit: number | null;
  status: string;
  visibility: string;
}

export interface QuestionRequest {
  content: string;
  orderIndex: number;
  points: number;
  questionType: string;
  options: { content: string; correct: boolean; orderIndex: number }[];
  correctTextAnswer?: string | null;
}

export async function fetchAdminExams(): Promise<ExamSummary[]> {
  const res = await fetch(`${API_BASE_URL}/admin/exams`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load exams');
  return res.json();
}

export async function fetchAdminExam(id: number): Promise<ExamDetailAdmin> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/${id}`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Exam not found');
  return res.json();
}

export async function createExam(data: ExamRequest): Promise<ExamDetailAdmin> {
  const res = await fetch(`${API_BASE_URL}/admin/exams`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? 'Failed to create exam'); }
  return res.json();
}

export async function updateExam(id: number, data: ExamRequest): Promise<ExamDetailAdmin> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/${id}`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? 'Failed to update exam'); }
  return res.json();
}

export async function deleteExam(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/${id}`, { method: 'DELETE', headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to delete exam');
}

export async function addQuestion(examId: number, data: QuestionRequest): Promise<QuestionAdmin> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/${examId}/questions`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? 'Failed to add question'); }
  return res.json();
}

export async function updateQuestion(questionId: number, data: QuestionRequest): Promise<QuestionAdmin> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/questions/${questionId}`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to update question');
  return res.json();
}

export async function deleteQuestion(questionId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/questions/${questionId}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to delete question');
}

// ── Member: Exam taking ───────────────────────────────────────────────────────

export async function fetchMemberExams(): Promise<ExamSummary[]> {
  const res = await fetch(`${API_BASE_URL}/member/exams`, { headers: memberAuthHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load exams');
  return res.json();
}

export async function fetchMemberExam(id: number): Promise<ExamDetailMember> {
  const res = await fetch(`${API_BASE_URL}/member/exams/${id}`, { headers: memberAuthHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Exam not found');
  return res.json();
}

export async function startAttempt(examId: number): Promise<AttemptSummary> {
  const res = await fetch(`${API_BASE_URL}/member/exams/${examId}/attempts`, {
    method: 'POST',
    headers: memberAuthHeader(),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to start attempt');
  return res.json();
}

export async function submitAttempt(
  attemptId: number,
  answers: { questionId: number; selectedOptionIds: number[]; textAnswer?: string }[],
): Promise<AttemptDetail> {
  const res = await fetch(`${API_BASE_URL}/member/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { ...memberAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? 'Failed to submit'); }
  return res.json();
}

export async function fetchMyAttempts(): Promise<AttemptSummary[]> {
  const res = await fetch(`${API_BASE_URL}/member/attempts`, { headers: memberAuthHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load attempts');
  return res.json();
}

export async function fetchAttemptDetail(attemptId: number): Promise<AttemptDetail> {
  const res = await fetch(`${API_BASE_URL}/member/attempts/${attemptId}`, { headers: memberAuthHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Attempt not found');
  return res.json();
}

// ── Content image upload ──────────────────────────────────────────────────────

export async function uploadContentImage(file: File): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/admin/images`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { message?: string }).message ?? 'Failed to upload image');
  }
  return res.json();
}

// ── Content video upload ──────────────────────────────────────────────────────

export interface VideoUploadResult {
  id: string;
  url: string;
  durationSeconds: number;
  size: number;
}

// Client-side guard mirroring the backend's raw-upload cap (ContentVideoController.MAX_RAW_SIZE) —
// fails fast before spending a 200MB request, backend still enforces the real limit.
export const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;

export async function uploadContentVideo(file: File): Promise<VideoUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/admin/videos`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { message?: string }).message ?? 'Failed to upload video');
  }
  return res.json();
}

// ── Post attachments (PDF/DOC/DOCX/TXT) ───────────────────────────────────────

export async function uploadPostAttachment(postId: number, file: File): Promise<PostAttachment> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/admin/posts/${postId}/attachments`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { message?: string }).message ?? 'Failed to upload attachment');
  }
  return res.json();
}

export async function deletePostAttachment(postId: number, attachmentId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/posts/${postId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) {
    throw new Error('Failed to delete attachment');
  }
}

/** Fetches attachment bytes for inline viewing on the post-detail page — an authenticated
 * fetch (not a bare URL), so private-post attachments stay behind the same access check
 * as the post itself. `attachment.url` is already a root-relative `/api/...` path (same
 * convention as `coverImageUrl`), so it's used as-is, not joined with API_BASE_URL. */
export async function fetchAttachmentBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { headers: publicAuthHeader() });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Attachment not found' : 'Failed to load attachment');
  }
  return res.blob();
}

// ── Admin: Attempt history ────────────────────────────────────────────────────

export async function fetchAdminAttempts(examId?: number): Promise<AdminAttemptSummary[]> {
  const params = examId != null ? `?examId=${examId}` : '';
  const res = await fetch(`${API_BASE_URL}/admin/attempts${params}`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load attempts');
  return res.json();
}

export async function fetchAdminAttemptDetail(attemptId: number): Promise<AdminAttemptDetail> {
  const res = await fetch(`${API_BASE_URL}/admin/attempts/${attemptId}`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Attempt not found');
  return res.json();
}

// ── Self-registration & current-user status ──────────────────────────────────

export async function registerMember(username: string, email: string, password: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { message?: string }).message ?? 'Registration failed');
  }
  return res.json();
}

/** Uses whichever session is present (admin or member) — for the "your account is pending" banner. */
export async function fetchMe(): Promise<MeResponse | null> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: publicAuthHeader() });
  if (!res.ok) return null;
  return res.json();
}

// ── Access Groups (admin) ─────────────────────────────────────────────────────

export interface AccessGroupRequestDto {
  name: string;
  slug: string;
  description: string;
  enabled: boolean;
}

export async function fetchAccessGroups(): Promise<AccessGroup[]> {
  const res = await fetch(`${API_BASE_URL}/admin/access-groups`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load access groups');
  return res.json();
}

export async function fetchAccessGroup(id: number): Promise<AccessGroup> {
  const res = await fetch(`${API_BASE_URL}/admin/access-groups/${id}`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Access group not found');
  return res.json();
}

export async function createAccessGroup(data: AccessGroupRequestDto): Promise<AccessGroup> {
  const res = await fetch(`${API_BASE_URL}/admin/access-groups`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? 'Failed to create access group'); }
  return res.json();
}

export async function updateAccessGroup(id: number, data: AccessGroupRequestDto): Promise<AccessGroup> {
  const res = await fetch(`${API_BASE_URL}/admin/access-groups/${id}`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? 'Failed to update access group'); }
  return res.json();
}

export async function deleteAccessGroup(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/access-groups/${id}`, { method: 'DELETE', headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to delete access group');
}

export async function fetchAccessGroupUsers(id: number): Promise<UserBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/access-groups/${id}/users`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load group members');
  return res.json();
}

export async function addUserToAccessGroup(groupId: number, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/access-groups/${groupId}/users/${userId}`, {
    method: 'POST', headers: authHeader(),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to add user to group');
}

export async function removeUserFromAccessGroup(groupId: number, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/access-groups/${groupId}/users/${userId}`, {
    method: 'DELETE', headers: authHeader(),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to remove user from group');
}

// ── Post-level access management (admin) ──────────────────────────────────────

export async function fetchPostAccessGroups(postId: number): Promise<AccessGroupBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/posts/${postId}/access-groups`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load post access groups');
  return res.json();
}

export async function setPostAccessGroups(postId: number, groupIds: number[]): Promise<AccessGroupBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/posts/${postId}/access-groups`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(groupIds),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to update post access groups');
  return res.json();
}

export async function fetchPostAccessUsers(postId: number): Promise<UserBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/posts/${postId}/access-users`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load post access users');
  return res.json();
}

export async function setPostAccessUsers(postId: number, userIds: number[]): Promise<UserBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/posts/${postId}/access-users`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(userIds),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to update post access users');
  return res.json();
}

// ── Exam-level access management (admin) ───────────────────────────────────────

export async function fetchExamAccessGroups(examId: number): Promise<AccessGroupBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/${examId}/access-groups`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load exam access groups');
  return res.json();
}

export async function setExamAccessGroups(examId: number, groupIds: number[]): Promise<AccessGroupBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/${examId}/access-groups`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(groupIds),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to update exam access groups');
  return res.json();
}

export async function fetchExamAccessUsers(examId: number): Promise<UserBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/${examId}/access-users`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load exam access users');
  return res.json();
}

export async function setExamAccessUsers(examId: number, userIds: number[]): Promise<UserBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/exams/${examId}/access-users`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(userIds),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to update exam access users');
  return res.json();
}

// ── Access Requests ────────────────────────────────────────────────────────────

export async function createAccessRequest(postSlug: string, message?: string): Promise<AccessRequest> {
  const res = await fetch(`${API_BASE_URL}/access-requests`, {
    method: 'POST',
    headers: { ...publicAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ postSlug, message: message ?? null }),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? 'Failed to request access'); }
  return res.json();
}

export async function fetchMyAccessRequests(): Promise<AccessRequest[]> {
  const res = await fetch(`${API_BASE_URL}/access-requests/me`, { headers: publicAuthHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load access requests');
  return res.json();
}

export async function fetchAdminAccessRequests(status: AccessRequest['status'] = 'PENDING'): Promise<AccessRequest[]> {
  const res = await fetch(`${API_BASE_URL}/admin/access-requests?status=${status}`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load access requests');
  return res.json();
}

export async function approveAccessRequest(
  id: number,
  grantVia: 'DIRECT' | 'GROUP',
  accessGroupId?: number,
): Promise<AccessRequest> {
  const res = await fetch(`${API_BASE_URL}/admin/access-requests/${id}/approve`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantVia, accessGroupId: accessGroupId ?? null }),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? 'Failed to approve request'); }
  return res.json();
}

export async function rejectAccessRequest(id: number): Promise<AccessRequest> {
  const res = await fetch(`${API_BASE_URL}/admin/access-requests/${id}/reject`, {
    method: 'PUT', headers: authHeader(),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to reject request');
  return res.json();
}

// ── Audit Log (admin, read-only) ───────────────────────────────────────────────

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const res = await fetch(`${API_BASE_URL}/admin/audit-logs`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load audit logs');
  return res.json();
}

// ── Book Library ────────────────────────────────────────────────────────────

interface BookQuery {
  q?: string;
  category?: string;
  fileType?: BookFileType;
}

export async function fetchBooks(query: BookQuery = {}): Promise<Book[]> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.fileType) params.set('fileType', query.fileType);

  const response = await fetch(`${API_BASE_URL}/books?${params.toString()}`, {
    headers: publicAuthHeader(),
  });
  if (!response.ok) {
    throw new Error('Unable to load the library');
  }
  return response.json();
}

export async function fetchBookBySlug(slug: string): Promise<Book> {
  const response = await fetch(`${API_BASE_URL}/books/${slug}`, {
    headers: publicAuthHeader(),
  });
  if (response.status === 401 || response.status === 403) {
    const body = await response.json().catch(() => ({}));
    throw new BookAccessDeniedError((body.code as AccessDenialCode) ?? 'NO_ACCESS');
  }
  if (!response.ok) {
    throw new Error('Book not found');
  }
  return response.json();
}

/** Authenticated fetch of the raw book bytes — same pattern as fetchAttachmentBlob,
 * which is what keeps a private book's file gated for the reader. */
export async function fetchBookFileBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { headers: publicAuthHeader() });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Book not found' : 'Failed to load the book file');
  }
  return res.blob();
}

export async function fetchAdminBooks(): Promise<Book[]> {
  const response = await fetch(`${API_BASE_URL}/admin/books`, { headers: authHeader() });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Unable to load books');
  return response.json();
}

export async function fetchAdminBookById(id: number): Promise<Book> {
  const response = await fetch(`${API_BASE_URL}/admin/books/${id}`, { headers: authHeader() });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Unable to load book');
  return response.json();
}

export interface BookRequest {
  title: string;
  slug: string;
  author?: string;
  description?: string;
  category?: string;
  status: BookStatus;
  visibility: BookVisibility;
  metadataVisibility?: BookMetadataVisibility;
  downloadable: boolean;
}

function buildBookFormData(data: BookRequest, file?: File, coverImage?: File): FormData {
  const fd = new FormData();
  fd.append('title', data.title);
  fd.append('slug', data.slug);
  if (data.author) fd.append('author', data.author);
  if (data.description) fd.append('description', data.description);
  if (data.category) fd.append('category', data.category);
  fd.append('status', data.status);
  fd.append('visibility', data.visibility);
  if (data.metadataVisibility) fd.append('metadataVisibility', data.metadataVisibility);
  fd.append('downloadable', data.downloadable ? 'true' : 'false');
  if (file) fd.append('file', file);
  if (coverImage) fd.append('coverImage', coverImage);
  return fd;
}

export async function createBook(data: BookRequest, file: File, coverImage?: File): Promise<Book> {
  const response = await fetch(`${API_BASE_URL}/admin/books`, {
    method: 'POST',
    headers: { ...authHeader() },
    body: buildBookFormData(data, file, coverImage),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) {
    const b = await response.json().catch(() => ({}));
    throw new Error((b as { message?: string }).message ?? 'Failed to create book');
  }
  return response.json();
}

export async function updateBook(
  id: number,
  data: BookRequest,
  file?: File,
  coverImage?: File,
  removeCoverImage?: boolean,
): Promise<Book> {
  const fd = buildBookFormData(data, file, coverImage);
  fd.append('removeCoverImage', removeCoverImage ? 'true' : 'false');
  const response = await fetch(`${API_BASE_URL}/admin/books/${id}`, {
    method: 'PUT',
    headers: { ...authHeader() },
    body: fd,
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) {
    const b = await response.json().catch(() => ({}));
    throw new Error((b as { message?: string }).message ?? 'Failed to update book');
  }
  return response.json();
}

export async function updateBookStatus(id: number, status: BookStatus): Promise<Book> {
  const response = await fetch(`${API_BASE_URL}/admin/books/${id}/status?status=${status}`, {
    method: 'PUT',
    headers: authHeader(),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to update book status');
  return response.json();
}

export async function deleteBook(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/books/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to delete book');
}

export async function fetchBookAccessGroups(bookId: number): Promise<AccessGroupBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/books/${bookId}/access-groups`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load book access groups');
  return res.json();
}

export async function setBookAccessGroups(bookId: number, groupIds: number[]): Promise<AccessGroupBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/books/${bookId}/access-groups`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(groupIds),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to update book access groups');
  return res.json();
}

export async function fetchBookAccessUsers(bookId: number): Promise<UserBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/books/${bookId}/access-users`, { headers: authHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load book access users');
  return res.json();
}

export async function setBookAccessUsers(bookId: number, userIds: number[]): Promise<UserBrief[]> {
  const res = await fetch(`${API_BASE_URL}/admin/books/${bookId}/access-users`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(userIds),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to update book access users');
  return res.json();
}

// ── Reading progress ───────────────────────────────────────────────────────────

// NOTE: these two use publicAuthHeader() (falls back to the member token), not
// authHeader() (admin token only) — this endpoint's real audience is MEMBER
// readers of private books. Using authHeader() here previously meant a MEMBER
// sent no Authorization header at all, silently 401'd, and server-side reading
// progress never persisted for them (found during the Book Library Phase 2
// design review; see docs/06-project-memory.md).
export async function fetchBookProgress(bookId: number): Promise<ReadProgress | null> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/progress`, { headers: publicAuthHeader() });
  if (res.status === 204) return null;
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load reading progress');
  return res.json();
}

export async function putBookProgress(
  bookId: number,
  progress: { position: number; total: number; unit: ProgressUnit },
): Promise<ReadProgress> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/progress`, {
    method: 'PUT',
    headers: { ...publicAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to save reading progress');
  return res.json();
}

/** The "continue reading" shelf — requires an authenticated (admin or member) session. */
export async function fetchContinueReading(limit = 6): Promise<Book[]> {
  const res = await fetch(`${API_BASE_URL}/me/reading?limit=${limit}`, { headers: publicAuthHeader() });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error('Failed to load continue-reading list');
  }
  return res.json();
}

// ── Highlights (Phase 2, docs/09-book-highlights-phase2.md §5) ─────────────────
// All 5 use publicAuthHeader() — same reasoning as the progress endpoints above
// (§4.4): the real audience is MEMBER readers, not just admins.

export interface CreateHighlightRequest {
  anchorType: HighlightAnchorType;
  startOffset?: number | null;
  endOffset?: number | null;
  pageNumber?: number | null;
  rects?: HighlightRect[] | null;
  color?: HighlightColor;
  text: string;
  note?: string | null;
}

async function readHighlightError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const b = body as { code?: string; message?: string };
  throw new HighlightError(b.code ?? 'ERROR', b.message ?? fallback);
}

/** This reader's highlights for one book, in document order — loaded once when the reader opens. */
export async function fetchBookHighlights(bookId: number): Promise<BookHighlight[]> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/highlights`, { headers: publicAuthHeader() });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) return readHighlightError(res, 'Failed to load highlights');
  return res.json();
}

export async function createBookHighlight(bookId: number, request: CreateHighlightRequest): Promise<BookHighlight> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/highlights`, {
    method: 'POST',
    headers: { ...publicAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) return readHighlightError(res, 'Failed to save highlight');
  return res.json();
}

/** Note text only — the anchor and snippet are immutable (§5.1). Pass `null` to clear the note. */
export async function updateBookHighlightNote(
  bookId: number,
  highlightId: number,
  note: string | null,
): Promise<BookHighlight> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/highlights/${highlightId}`, {
    method: 'PUT',
    headers: { ...publicAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) return readHighlightError(res, 'Failed to update note');
  return res.json();
}

export async function deleteBookHighlight(bookId: number, highlightId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/highlights/${highlightId}`, {
    method: 'DELETE',
    headers: publicAuthHeader(),
  });
  if (res.status === 401 || res.status === 403) throw new UnauthorizedError();
  if (!res.ok) return readHighlightError(res, 'Failed to delete highlight');
}

/** The cross-book "My Highlights" shelf — newest-updated first, access-filtered server-side. */
export async function fetchMyHighlights(limit = 100): Promise<MyBookHighlight[]> {
  const res = await fetch(`${API_BASE_URL}/me/highlights?limit=${limit}`, { headers: publicAuthHeader() });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error('Failed to load your highlights');
  }
  return res.json();
}
