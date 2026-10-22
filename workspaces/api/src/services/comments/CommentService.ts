
import { commentSelect, toComment } from './selectors.js';
import type { PrismaClient } from '@growthlog/db';
import type { Comment } from './interfaces.js';
import { ReplyTargetNotFound, ForbiddenError } from './errors.js';

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

  public async getComments(postId: string, cursor?: string, take = 10): Promise<Comment[]> {
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: commentSelect,
    });

    return rows.map(toComment);
  }

  public async getReplies(postId: string, parentId: string, cursor?: string, take = 10): Promise<Comment[]> {
    const rows = await this.prisma.comment.findMany({
      where: {
        postId,
        parentId,
        deletedAt: null,
      },
      take,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: commentSelect,
    });

    return rows.map(toComment);
  }

  public async like(commentId: string, userId: string) {
    await this.prisma.commentLike.upsert({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
      create: {
        commentId,
        userId,
      },
      update: {},
    });
  }

  public async unlike(commentId: string, userId: string) {
    await this.prisma.commentLike.deleteMany({
      where: {
        commentId,
        userId,
      },
    });
  }

  public async edit(id: string, commenterId: string, postId: string, text: string): Promise<Comment> {
    await this.assertIsOriginalCommenter(id, commenterId);

    const edited = await this.prisma.comment.update({
      where: {
        id,
        postId,
        commenterId,
      },
      data: { text },
      select: commentSelect,
    });

    return toComment(edited);
  }

  public async delete(id: string, commenterId: string, postId: string) {
    await this.assertIsOriginalCommenter(id, commenterId);

    await this.prisma.comment.update({
      where: {
        id,
        postId,
        commenterId,
      },
      data: {
        deletedAt: new Date(),
        text: '',
      },
    });
  }

  private async assertIsOriginalCommenter(id: string, commenterId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id },
      select: { commenterId: true },
    });

    if (!comment) return;
    if (comment.commenterId !== commenterId) throw new ForbiddenError();
  }
}
