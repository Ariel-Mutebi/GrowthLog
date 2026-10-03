import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { CreateBlankPost, UpdatePost, GetOwnPost } from './schema.js';
import { PostNotFoundError, PostService, SlugConflictError } from './service.js';

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
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.patch('/:id', {
    preHandler: isLoggedIn,
    schema: UpdatePost,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const updated = await service.update({
        authorId: req.user.id,
        postId: req.params.id,
        ...req.body,
      });
      return res.code(200).send(updated);
    } catch (error) {
      if (error instanceof PostNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'The post you are trying to edit could not be found',
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
    preHandler: isLoggedIn,
    schema: GetOwnPost,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const post = await service.getPost(req.user.id, req.params.id);
      return res.code(200).send(post);
    } catch (error) {
      if (error instanceof PostNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'The post you are looking for was not found among your own posts',
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
