import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { TagSearch } from './schema.js';
import { TagService } from '@/services/TagService.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new TagService(app.prisma);

  app.get('/', {
    schema: TagSearch,
  }, async (req, res) => {
    const result = await service.searchTags(req.query.search);
    return res.status(200).send(result);
  });
};

export default router;
