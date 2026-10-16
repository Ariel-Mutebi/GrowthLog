import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn } from '../../../auth/preHandler.js';
import { CreateDraft, GetDraft, GetDrafts, UpdateDraft } from './schema.js';
import { DraftService } from '../../../services/posts/DraftService.js';
import { PostNotFoundError, SlugConflictError } from '../../../services/posts/shared/errors.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new DraftService(app.prisma);

  app.get('/', {
    schema: GetDrafts,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const drafts = await service.getDrafts(req.user.id, req.query);
      return res.code(200).send(drafts);
    } catch (error) {
      req.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.post('/', {
    schema: CreateDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const draft = await service.create(req.user.id);
      return res.code(201).send(draft);
    } catch (error) {
      req.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
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

      if (error instanceof SlugConflictError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'That url-slug is already in use',
        });
      }

      req.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
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

      req.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });
};

export default router;
