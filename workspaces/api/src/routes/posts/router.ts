import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { CreateBlankPost } from './schema.js';
import { PostService } from './service.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new PostService(app.prisma);

  app.post('/', {
    preHandler: isLoggedIn,
    schema: CreateBlankPost,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const blankPost = await service.create(req.user.id);
      return res.code(201).send(blankPost);
    } catch (error) {
      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong, please try again.',
      });
    }
  });
};

export default router;
