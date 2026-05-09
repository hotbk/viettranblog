export type PostStatus = 'DRAFT' | 'PUBLISHED';

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
