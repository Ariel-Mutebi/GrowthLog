import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { LikeService } from '@/services/posts/LikeService.js';
import { isLoggedIn, assertIsLoggedIn } from '@/auth/preHandler.js';
import { LikePost, UnlikePost } from './schema.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new LikeService(app.prisma);
  
  app.addHook('preHandler', isLoggedIn);

  app.put('/', {
    schema: LikePost,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.like(req.params.postId, req.user.id);
    return res.code(204).send(null);
  });

  app.delete('/', {
    schema: UnlikePost,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.unlike(req.params.postId, req.user.id);
    return res.code(204).send(null);
  });
};

export default router;
