interface Author {
  id: string;
  forename: string;
  surname: string;
  avatarKey: string | null;
}

export interface ReadingView {
  id: string;
  title: string;
  author: Author;
  likes: number;
  comments: number;
  coverKey: string;
  readingTime: number;
  publishedAt: Date;
  publishedHtml: string;
}

export interface FeedView {
  id: string;
  title: string;
  tags: string[];
  author: Author;
  readingTime: number;
  coverKey: string;
}

export interface DraftMetadata {
  id: string;
  title: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export interface DraftQueryOptions {
  sortBy: 'title' | 'updatedAt';
  order: 'asc' | 'desc';
  published: boolean;
}
