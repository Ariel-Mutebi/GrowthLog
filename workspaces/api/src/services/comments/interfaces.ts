import type { PublicUser } from '../users/shared/interfaces.js';

export interface Comment {
  id: string;
  text: string | null;
  commenter: PublicUser | null;
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
    username: string;
    createdAt: Date;
    bio: string | null;
    avatar: {
      image: {
        key: string;
      };
    } | null;
  };
  _count: { likes: number; replies: number };
};
