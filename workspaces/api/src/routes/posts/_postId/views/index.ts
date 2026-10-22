import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { View } from './schema.js';
import { ViewService } from '@/services/ViewService.js';
import { assertIsLoggedIn, isLoggedIn } from '@/auth/preHandler.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new ViewService(app.prisma);

  app.post('/', {
    schema: View,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    await service.saveView(
      req.params.postId,
      req.user.id,
      req.body.type,
    );

    return res.status(204).send(null);
  });
};

export default router;
