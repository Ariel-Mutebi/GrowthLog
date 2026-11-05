import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CommentService } from '@/services/posts/CommentService.js';
import { isLoggedIn, assertIsLoggedIn } from '@/auth/preHandler.js';
import { DeleteComment, EditComment, GetReplies, LikeComment, ReplyToComment } from './schema.js';
import { ForbiddenError, CommentNotFoundError } from '@/services/posts/shared/errors.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new CommentService(app.prisma);

  app.put('/likes', {
    schema: LikeComment,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.like(req.params.commentId, req.user.id);
    return res.code(204).send(null);
  });

  app.delete('/likes', {
    schema: LikeComment,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.unlike(req.params.commentId, req.user.id);
    return res.code(204).send(null);
  });

  app.get('/replies', {
    schema: GetReplies,
  }, async (req, res) => {
    const replies = await service.getReplies({
      postId: req.params.postId,
      parentId: req.params.commentId,
      cursor: req.query.cursor,
      take: req.query.take,
    });
    return res.code(200).send(replies);
  });

  app.post('/replies', {
    schema: ReplyToComment,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    
    const newReply = await service.reply({
      commenterId: req.user.id,
      postId: req.params.postId,
      targetId: req.params.commentId,
      text: req.body.text,
    });

    return res.code(201).send(newReply);
  });

  // can be re-used for editing and deleting replies
  app.patch('/', {
    schema: EditComment,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const edited = await service.edit(
        req.params.commentId,
        req.user.id,
        req.params.postId,
        req.body.text,
      );
      return res.code(200).send(edited);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.code(403).send({
          error: 'Forbidden',
          message: 'You cannot edit a comment you did not author',
        });
      }

      throw error;
    }
  });

  app.delete('/', {
    schema: DeleteComment,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await service.delete(req.params.commentId, req.user.id, req.params.postId);
      return res.code(204).send(null);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.code(403).send({
          error: 'Forbidden',
          message: 'You cannot delete a comment you did not author',
        });
      }

      throw error;
    }
  });

  app.setErrorHandler((error, _req, res) => {
    if (error instanceof CommentNotFoundError) {
      return res.code(404).send({
        error: 'NotFound',
        message: 'This comment could not be found',
      });
    }

    throw error;
  });
};

export default router;
