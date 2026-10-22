import { GetFeed, ReadPost } from './schema.js';
import { ReadService } from '@/services/posts/ReadService.js';
import { PostNotFoundError } from '@/services/posts/shared/errors.js';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new ReadService(app.prisma);

  app.get('/', {
    schema: GetFeed,
  }, async (req, res) => {
    const feed = req.user
      ? await service.getFeed(req.user.id)
      : await service.getLatest();

    return res.status(200).send(feed);
  });

  app.get('/:slug', {
    schema: ReadPost,
  }, async (req, res) => {
    try {
      const data = await service.read(req.params.slug);
      return res.status(200).send(data);
    } catch (error) {
      if (error instanceof PostNotFoundError) {
        return res.status(404).send({
          error: 'NotFound',
          message: 'The post could not be found. Maybe the author unpublished or deleted it.',
        });
      }

      throw error;
    }
  });
};

export default router;
