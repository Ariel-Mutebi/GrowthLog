import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn } from '@/auth/preHandler.js';
import { PublishService } from '@/services/posts/PublishService.js';
import {
  EmptyPostError,
  InvalidContentError,
  InvalidCoverImageError,
  InvalidImageError,
  SlugConflictError,
  TitleRequiredError,
} from '@/services/posts/shared/errors.js';
import { PublishDraft, Prepublish, Unpublish } from './schema.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new PublishService(
    app.prisma,
    app.cleaner,
    app.config.PUBLIC_MINIO_ENDPOINT,
    app.config.PUBLIC_IMAGE_BUCKET,
  );

  app.get('/', {
    schema: Prepublish,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const defaults = await service.prepublish(req.user.id, req.params.id);
    return res.code(200).send(defaults);
  });

  app.post('/', {
    schema: PublishDraft,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await service.publish(req.user.id, req.params.id, req.body);
      return res.code(204).send(null);
    } catch (error) {
      if (error instanceof SlugConflictError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'That url-slug is already in use',
        });
      }

      if (error instanceof TitleRequiredError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'You cannot publish an untitled post',
        });
      }

      if (error instanceof EmptyPostError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'You cannot publish an empty post',
        });
      }

      if (error instanceof InvalidCoverImageError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'This cover image is not valid',
        });
      }

      if (error instanceof InvalidContentError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'This draft contains content that cannot be published',
        });
      }

      if (error instanceof InvalidImageError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'You cannot use externally-hosted images',
        });
      }

      throw error;
    }
  });

  app.delete('/', {
    schema: Unpublish,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.unpublish(req.user.id, req.params.id);
    return res.code(204).send(null);
  });
};

export default router;
