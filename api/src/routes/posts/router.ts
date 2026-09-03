import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import slugify from 'slugify';
import { CreatePostSchema, UpdatePostMetadata } from './schema.js';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { extractConflictColumns, handleDBConflict } from '../../error/database.js';

const MAX_SLUG_RETRIES = 100;

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    preHandler: isLoggedIn,
    schema: CreatePostSchema,
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

    /**
     * Derive the post's slug from the title; add incremental suffix if other
     * posts already exists with this same slug. Retry-on-conflict rather than
     * pre-check availability to defend against TOCTOU race conditions with async requests.
     */
    const baseSlug = slugify(title, { lower: true, strict: true });
    
    for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
      const suggestedSlug = attempt == 0 ? baseSlug : `${baseSlug}-${attempt}`;

      try {
        const post = await app.prisma.post.create({
          data: {
            authorId: req.user.id,
            slug: suggestedSlug,
            title,
          },
        });

        return res.code(201).send(post);
      } catch (error) {
        const isSlugConflict = error instanceof PrismaClientKnownRequestError
          && error.code === 'P2002'
          && extractConflictColumns(error.meta).includes('slug');

        if (!isSlugConflict || attempt == MAX_SLUG_RETRIES - 1) throw error;
      }
    }
  });

  app.put(':postId/meta', {
    preHandler: isLoggedIn,
    schema: UpdatePostMetadata,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const post = await app.prisma.post.update({
        where: {
          id: req.params.postId,
          authorId: req.user.id,
        },
        data: req.body,
      });
      res.code(200).send(post);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2025':
            res.code(404).send({
              error: 'NotFound',
              message: 'The post that you\'re tying to edit cannot be found',
            });
            break;

          case 'P2002':
            return handleDBConflict(error, res);
        
          default:
            throw error;
        }
      }
    }
  });
};

export default router;
