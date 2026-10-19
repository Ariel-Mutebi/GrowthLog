import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn } from '@/auth/preHandler.js';
import { CreateDraft, GetDrafts } from './schema.js';
import { DraftService } from '@/services/posts/DraftService.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new DraftService(app.prisma);

  app.get('/', {
    schema: GetDrafts,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const drafts = await service.getDrafts(req.user.id, req.query);
    return res.code(200).send(drafts);
  });

  app.post('/', {
    schema: CreateDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const draft = await service.create(req.user.id);
    return res.code(201).send(draft);
  });
};

export default router;
