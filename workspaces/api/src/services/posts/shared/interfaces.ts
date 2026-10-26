export interface Author {
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
  hasLiked: boolean;
  readingTime: number;
  publishedAt: Date;
  publishedHtml: string;
}

export interface FeedView {
  id: string;
  slug: string;
  title: string;
  hook: string;
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

export interface Comment {
  id: string;
  text: string | null;
  commenter: Author | null;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  replyCount: number;
}

export interface CommentRow {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  commenter: {
    id: string;
    forename: string;
    surname: string;
    avatar: {
      image: {
        key: string;
      };
    } | null;
  };
  _count: { likes: number; replies: number };
};
