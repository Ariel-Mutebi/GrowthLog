import slugify from 'slugify';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { CreateDraftSchema, GetMyPostsSchema, UpdatePostMetadata } from './schema.js';
import { attemptWithConflictRetry, doOrHandleDBConflict } from '../../error/database.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/mine', {
    preHandler: isLoggedIn,
    schema: GetMyPostsSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const posts = await app.prisma.post.findMany({
      where: {
        authorId: req.user.id,
      },
      omit: {
        content: true,
        publishedHtml: true,
      },
    });

    return res.code(200).send(posts);
  });

  app.post('/', {
    preHandler: isLoggedIn,
    schema: CreateDraftSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const { title, slug } = req.body;

    const createPost = async (slug: string) => {
      const post = await app.prisma.post.create({
        data: {
          authorId: req.user.id,
          title,
          slug,
        },
      });

      return res.code(201).send(post);
    };

    if (slug) {
      return await createPost(slug);
    }

    attemptWithConflictRetry({
      res,
      attempt: createPost,
      conflictColumn: 'slug',
      base: slugify(title, { lower: true, strict: true }),
    });
  });

  app.put(':postId/meta', {
    preHandler: isLoggedIn,
    schema: UpdatePostMetadata,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const { title, slug } = req.body;

    interface Data {
      title?: string;
      slug?: string;
    }

    const updatePost = async (data: Data) => {
      const post = await app.prisma.post.update({
        where: {
          id: req.params.postId,
          authorId: req.user.id,
        },
        data,
      });

      res.code(200).send(post);
    };

    try {
      if (title && slug) {
        return await doOrHandleDBConflict(() => updatePost({ title, slug }), res);
      }

      if (slug) {
        return await doOrHandleDBConflict(() => updatePost({ slug }), res);
      }

      if (title) {
        return await attemptWithConflictRetry({
          res,
          conflictColumn: 'slug',
          base: slugify(title, { lower: true, strict: true }),
          attempt: (candidate) => updatePost({ slug: candidate }),
        });
      }
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        res.code(404).send({
          error: 'NotFound',
          message: 'The post that you are tying to edit cannot be found',
        });
      }
      throw error;
    }
  });
};

export default router;
