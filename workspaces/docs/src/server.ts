import * as Y from 'yjs';
import jwt from 'jsonwebtoken';
import { Server } from '@hocuspocus/server';
import { loadEnv } from '@growthlog/env';
import { createPrismaClient } from '@growthlog/db';

interface JWTPayload {
  sub: string;
  name: string;
}

const config = loadEnv([
  'DOCS_PORT',
  'JWT_SECRET',
  'DATABASE_URL',
]);

const prisma = createPrismaClient(config.DATABASE_URL);

const server = new Server({
  port: config.DOCS_PORT,

  async onAuthenticate({ token, documentName }) {
    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    } catch {
      throw new Error('Invalid or expired token');
    }

    const post = await prisma.post.findUnique({
      where: {
        deletedAt: null,
        id: documentName,
        authorId: payload.sub,
      },
      select: {
        authorId: true,
      },
    });

    if (!post) throw new Error('Post not found');

    return { user: { id: payload.sub, name: payload.name } };
  },

  async onLoadDocument({ documentName }) {
    const post = await prisma.post.findUnique({
      where: {
        id: documentName,
        deletedAt: null,
      },
      select: {
        draftContent: true,
      },
    });

    if (post?.draftContent) {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, post.draftContent);
      return ydoc;
    }

    return undefined;
  },

  async onStoreDocument({ documentName, document }) {
    const state = Y.encodeStateAsUpdate(document);

    await prisma.post.update({
      where: {
        id: documentName,
      },
      data: {
        content: Buffer.from(state),
      },
    });
  },

  debounce: 2000,
  maxDebounce: 10000,
});

server.listen();
