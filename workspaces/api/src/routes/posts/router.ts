import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { CreateBlankPost, UpdatePost, GetOwnPost, GetOwnPosts, PublishPost, Prepublish } from './schema.js';
import { EmptyPostError, InvalidImageError, PostNotFoundError, PostService, SlugConflictError, TitleRequiredError } from './service.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new PostService(
    app.prisma,
    app.cleaner,
    app.config.PUBLIC_MINIO_ENDPOINT,
    app.config.PUBLIC_IMAGE_BUCKET,
  );

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
      const updated = await service.update(req.user.id, req.params.id, req.body);
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

  app.get('/:slug', {
    preHandler: isLoggedIn,
    schema: GetOwnPost,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const post = await service.getPost(req.user.id, req.params.slug);
      return res.code(200).send(post);
    } catch (error) {
      if (error instanceof PostNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'The post you are looking for was not found',
        });
      }

      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.get('/', {
    preHandler: isLoggedIn,
    schema: GetOwnPosts,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const posts = await service.getPosts(req.user.id, req.query);
      return res.code(200).send(posts);
    } catch (error) {
      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.get('/:id/prepublish', {
    preHandler: isLoggedIn,
    schema: Prepublish,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const defaults = await service.prepublish(req.user.id, req.params.id);
      return res.code(200).send(defaults);
    } catch (error) {
      if (error instanceof PostNotFoundError) {
        return res.code(400).send({
          error: 'NotFound',
          message: 'This post could not be found',
        });
      }

      req.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.post('/:id/publish', {
    preHandler: isLoggedIn,
    schema: PublishPost,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const publishedPost = await service.publishPost(req.user.id, req.params.id, req.body);
      return res.code(200).send(publishedPost);
    } catch (error) {
      if (error instanceof SlugConflictError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'That url slug is already in use',
        });
      }

      if (error instanceof InvalidImageError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'You can only use images hosted on GrowthLog\'s servers',
        });
      }

      if (error instanceof EmptyPostError) {
        return res.code(425).send({
          error: 'TooEarly',
          message: 'You cannot publish an empty post',
        });
      }

      if (error instanceof TitleRequiredError) {
        return res.code(425).send({
          error: 'TooEarly',
          message: 'You cannot publish an untitled post',
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
