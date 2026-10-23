import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CommentService } from '@/services/posts/CommentService.js';
import { isLoggedIn, assertIsLoggedIn } from '@/auth/preHandler.js';
import { GetComments, MakeComment } from './schema.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new CommentService(app.prisma);

  app.get('/', {
    schema: GetComments,
  }, async (req, res) => {
    const comments = await service.getComments({
      postId: req.params.postId,
      cursor: req.query.cursor,
      take: req.query.take,
    });

    return res.code(200).send(comments);
  });

  app.post('/', {
    schema: MakeComment,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const newComment = await service.comment({
      commenterId: req.user.id,
      postId: req.params.postId,
      text: req.body.text,
    });

    return res.code(200).send(newComment);
  });
};

export default router;
