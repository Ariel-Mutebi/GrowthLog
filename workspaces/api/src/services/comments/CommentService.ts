
import { commentSelect, toComment } from './selectors.js';
import type { PrismaClient } from '@growthlog/db';
import type { Comment } from './interfaces.js';
import { ReplyTargetNotFound } from './errors.js';

interface CommentData {
  text: string;
  postId: string;
  commenterId: string;
}

interface ReplyData extends CommentData {
  targetId: string;
}

export class CommentService {
  constructor(private readonly prisma: PrismaClient) {}

  public async comment(data: CommentData): Promise<Comment> {
    const row = await this.prisma.comment.create({
      data,
      select: commentSelect,
    });
    return toComment(row);
  }

  public async reply(data: ReplyData): Promise<Comment> {
    const { postId, commenterId, text, targetId } = data;

    const target = await this.prisma.comment.findFirst({
      where: {
        postId,
        id: targetId,
        deletedAt: null,
      },
      select: { parentId: true },
    });

    if (!target) throw new ReplyTargetNotFound();

    const row = await this.prisma.comment.create({
      data: {
        postId,
        commenterId,
        text,
        // replying to a reply attaches to the top-level comment
        parentId: target.parentId ?? targetId,
      },
      select: commentSelect,
    });

    return toComment(row);
  }

  public async listComments(postId: string, cursor?: string, take = 10): Promise<Comment[]> {
    const rows = await this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null,
        // hide deleted comments unless they still have replies
        OR: [
          { deletedAt: null },
          { replies: { some: { deletedAt: null } } },
        ],
      },
      take,
      orderBy: [{ createdAt: 'desc' }],
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: commentSelect,
    });

    return rows.map(toComment);
  }

  public async listReplies(parentId: string, cursor?: string, take = 10): Promise<Comment[]> {
    const rows = await this.prisma.comment.findMany({
      where: {
        parentId,
        deletedAt: null,
      },
      take,
      orderBy: [{ createdAt: 'desc' }],
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: commentSelect,
    });

    return rows.map(toComment);
  }

  public async like(commentId: string, userId: string) {
    await this.prisma.commentLike.create({
      data: {
        commentId,
        userId,
      },
    });
  }

  public async delete(id: string, commenterId: string) {
    await this.prisma.comment.updateMany({
      where: {
        id,
        commenterId,
      },
      data: {
        deletedAt: new Date(),
        text: '',
      },
    });
  }
}
