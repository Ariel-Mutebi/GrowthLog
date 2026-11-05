import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn } from '@/auth/preHandler.js';
import { DraftService } from '@/services/posts/DraftService.js';
import { UpdateDraft, GetDraft, DeleteDraft } from './schema.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new DraftService(app.prisma);

  app.patch('/', {
    schema: UpdateDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);
  
    const updated = await service.update(
      req.user.id,
      req.params.id,
      req.body.title,
    );

    return res.code(200).send(updated);
  });

  app.get('/', {
    schema: GetDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const draft = await service.getDraft(req.user.id, req.params.id);
    return res.code(200).send(draft);
  });

  app.delete('/', {
    schema: DeleteDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.deleteDraft(req.user.id, req.params.id);
    return res.code(204).send(null);
  });
};

export default router;
