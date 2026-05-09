import type { BlogPost } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

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
