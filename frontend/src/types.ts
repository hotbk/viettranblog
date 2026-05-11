export type PostStatus = 'DRAFT' | 'PUBLISHED';

export interface Comment {
  id: number;
  postId: number;
  authorName: string;
  authorEmail: string | null;
  content: string;
  createdAt: string;
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
}
