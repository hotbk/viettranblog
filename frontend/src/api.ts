import { authHeader } from './auth';
import { memberAuthHeader } from './memberAuth';
import type { BlogPost, Comment, SeriesSummary, SeriesDetail, PostStatus, ExamSummary, ExamDetailAdmin, ExamDetailMember, QuestionAdmin, AttemptSummary, AttemptDetail, AdminAttemptSummary, AdminAttemptDetail } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class UnauthorizedError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'UnauthorizedError';
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

  const response = await fetch(`${API_BASE_URL}/posts?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Unable to load posts');
  }

  return response.json();
}

export async function recordPostView(slug: string): Promise<void> {
  await fetch(`${API_BASE_URL}/posts/${slug}/view`, { method: 'POST' });
  // fire-and-forget — ignore errors silently
}

export async function fetchPostBySlug(slug: string): Promise<BlogPost> {
  const response = await fetch(`${API_BASE_URL}/posts/${slug}`);

  if (!response.ok) {
    throw new Error('Post not found');
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
  const response = await fetch(`${API_BASE_URL}/posts/${slug}/comments`);
  if (!response.ok) throw new Error('Failed to load comments');
  return response.json();
}

export async function submitComment(slug: string, data: CommentRequest): Promise<Comment> {
  const response = await fetch(`${API_BASE_URL}/posts/${slug}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  createdAt: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'EDITOR' | 'READER' | 'MEMBER';
}

export async function fetchAdminUsers(): Promise<UserResponse[]> {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: authHeader(),
  });

  if (response.status === 401 || response.status === 403) throw new UnauthorizedError();
  if (!response.ok) throw new Error('Failed to load users');

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
  const response = await fetch(`${API_BASE_URL}/series`);
  if (!response.ok) throw new Error('Failed to load series');
  return response.json();
}

export async function fetchSeriesBySlug(slug: string): Promise<SeriesDetail> {
  const response = await fetch(`${API_BASE_URL}/series/${slug}`);
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
}

export interface QuestionRequest {
  content: string;
  orderIndex: number;
  points: number;
  questionType: string;
  options: { content: string; correct: boolean; orderIndex: number }[];
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
  answers: { questionId: number; selectedOptionIds: number[] }[],
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
