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
}
