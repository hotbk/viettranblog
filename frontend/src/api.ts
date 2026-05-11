import { authHeader } from './auth';
import type { BlogPost, Comment } from './types';

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
  role: 'ADMIN' | 'EDITOR' | 'READER';
  createdAt: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'EDITOR' | 'READER';
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
