import { PrismaClientKnownRequestError } from '@growthlog/db';
import { commentSelect, toComment } from './shared/selectors.js';
import {
  PostNotFoundError,
  ForbiddenError,
  CommentNotFoundError,
} from './shared/errors.js';

import type { PrismaClient } from '@growthlog/db';
import type { Comment } from './shared/interfaces.js';

interface CreateCommentParams {
  text: string;
  postId: string;
  commenterId: string;
}

interface CreateReplyParams extends CreateCommentParams {
  targetId: string;
}

interface GetCommentParams {
  postId: string;
  take: number | undefined;
  cursor: string | undefined;
}

interface GetReplyParams extends GetCommentParams {
  parentId: string;
}

export class CommentService {
  constructor(private readonly prisma: PrismaClient) { }

  public async comment(data: CreateCommentParams): Promise<Comment> {
    try {
      const row = await this.prisma.comment.create({
        data,
        select: commentSelect,
      });
      return toComment(row);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new PostNotFoundError();
      }

      throw error;
    }
  }

  public async reply(data: CreateReplyParams): Promise<Comment> {
    const { postId, commenterId, text, targetId } = data;

    const target = await this.prisma.comment.findFirst({
      where: {
        postId,
        id: targetId,
        deletedAt: null,
      },
      select: { parentId: true },
    });

    if (!target) throw new CommentNotFoundError();

    try {
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
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new CommentNotFoundError();
      }
  
      throw error;
    }
  }

  public async getComments(params: GetCommentParams): Promise<Comment[]> {
    const { postId, cursor, take = 10 } = params;

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

  public async getReplies(params: GetReplyParams): Promise<Comment[]> {
    const { postId, parentId, cursor, take = 10 } = params;

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
    try {
      await this.prisma.commentLike.upsert({
        where: { userId_commentId: { userId, commentId } },
        create: { commentId, userId },
        update: {},
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002'){
        return;
      }

      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new CommentNotFoundError();
      }

      throw error;
    }
  }

  public async unlike(commentId: string, userId: string) {
    await this.prisma.commentLike.deleteMany({
      where: { commentId, userId },
    });
  }

  public async edit(id: string, commenterId: string, postId: string, text: string): Promise<Comment> {
    const comment = await this.getOwnedComment(id, commenterId, postId);
    if (comment.deletedAt) throw new CommentNotFoundError();

    try {
      const edited = await this.prisma.comment.update({
        where: { id, postId, commenterId },
        data: { text },
        select: commentSelect,
      });

      return toComment(edited);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new CommentNotFoundError();
      }

      throw error;
    }
  }

  public async delete(id: string, commenterId: string, postId: string) {
    const comment = await this.getOwnedComment(id, commenterId, postId);
    if (comment.deletedAt) return;

    try {
      await this.prisma.comment.update({
        where: { id, postId, commenterId },
        data: {
          deletedAt: new Date(),
          text: '',
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new CommentNotFoundError();
      }

      throw error;
    }
  }

  private async getOwnedComment(id: string, commenterId: string, postId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id, postId },
      select: { commenterId: true, deletedAt: true },
    });

    if (!comment) throw new CommentNotFoundError();
    if (comment.commenterId !== commenterId) throw new ForbiddenError();
    return comment;
  }
}
