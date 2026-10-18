import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn } from '../../../auth/preHandler.js';
import { CreateDraft, DeleteDraft, GetDraft, GetDrafts, UpdateDraft } from './schema.js';
import { DraftService } from '../../../services/posts/DraftService.js';
import { PostNotFoundError } from '../../../services/posts/shared/errors.js';

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

  app.patch('/:id', {
    schema: UpdateDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const updated = await service.update(req.user.id, req.params.id, req.body.title);
      return res.code(200).send(updated);
    } catch (error) {
      if (error instanceof PostNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'This draft could not be found',
        });
      }

      throw error;
    }
  });

  app.get('/:id', {
    schema: GetDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const draft = await service.getDraft(req.user.id, req.params.id);
      return res.code(200).send(draft);
    } catch (error) {
      if (error instanceof PostNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'This draft could not be found',
        });
      }

      throw error;
    }
  });

  app.delete('/:id', {
    schema: DeleteDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.deleteDraft(req.user.id, req.params.id);
    return res.code(204).send(null);
  });
};

export default router;
