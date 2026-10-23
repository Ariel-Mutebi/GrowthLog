import { avatarSelect } from '../../users/shared/selectors.js';
import { flattenAvatarKey } from '../../users/shared/helpers.js';
import type { CommentSelect, UserSelect } from '@growthlog/db';
import type { Comment, CommentRow } from './interfaces.js';

export const authorSelect = {
  id: true,
  forename: true,
  surname: true,
  ...avatarSelect,
} satisfies UserSelect;

export const commentSelect = {
  id: true,
  text: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  commenter: { select: authorSelect },
  _count: {
    select: {
      likes: true,
      replies: { where: { deletedAt: null } },
    },
  },
} satisfies CommentSelect;

export function toComment(row: CommentRow): Comment {
  const deleted = row.deletedAt !== null;

  return {
    id: row.id,
    text: deleted ? null : row.text,
    commenter: deleted ? null : flattenAvatarKey(row.commenter),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    likeCount: row._count.likes,
    replyCount: row._count.replies,
  };
}
