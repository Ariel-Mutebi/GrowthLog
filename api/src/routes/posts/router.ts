import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import slugify from 'slugify';
import { CreatePostSchema } from './schema.js';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { extractConflictColumns } from '../../error/database.js';

const MAX_SLUG_RETRIES = 100;

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    preHandler: isLoggedIn,
    schema: CreatePostSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const { title } = req.body;

    /**
     * Derive the post's slug from the title; add incremental suffix if other
     * posts already exists with this same slug. Retry-on-conflict rather than
     * pre-check availability to defend against TOCTOU race conditions.
     */

    const baseSlug = slugify(title, { lower: true, strict: true });
    
    for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
      const slug = attempt == 0 ? baseSlug : `${baseSlug}-${attempt}`;

      try {
        const { id } = await app.prisma.post.create({
          data: {
            authorId: req.user.id,
            slug,
            title,
          },
        });

        return res.code(201).send({ id });
      } catch (error) {
        const isSlugConflict = error instanceof PrismaClientKnownRequestError
          && error.code === 'P2002'
          && extractConflictColumns(error.meta).includes('slug');

        if (!isSlugConflict || attempt == MAX_SLUG_RETRIES - 1) throw error;
      }
    }
  });
};

export default router;
