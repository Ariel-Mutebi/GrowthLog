import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CommentService } from '@/services/comments/CommentService.js';
import { isLoggedIn, assertIsLoggedIn } from '@/auth/preHandler.js';
import { DeleteComment, EditComment, GetReplies, LikeComment, ReplyToComment } from './schema.js';
import { ForbiddenError, ReplyTargetNotFound } from '@/services/comments/errors.js';

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
    const replies = await service.getReplies(
      req.params.commentId,
      req.query.cursor,
      req.query.take,
    );
    return res.code(200).send(replies);
  });

  app.post('/replies', {
    schema: ReplyToComment,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    
    try {
      const newReply = await service.reply({
        commenterId: req.user.id,
        postId: req.params.postId,
        targetId: req.params.commentId,
        text: req.body.text,
      });

      return res.code(200).send(newReply);
    } catch (error) {
      if (error instanceof ReplyTargetNotFound) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'The comment you are replying to could not be found',
        });
      }

      throw error;
    }
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
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await service.delete(req.params.commentId, req.user.id);
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
};

export default router;
