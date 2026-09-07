import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { prisma } from './prisma.js';
import { verifyCollabToken } from './auth.js';
import { config } from './config.js';

const server = new Server({
  port: Number(config.WS_PORT) || 1234,

  async onAuthenticate({ token, documentName }) {
    let payload;
    try {
      payload = verifyCollabToken(token);
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
        content: true,
      },
    });

    if (post?.content) {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, post.content);
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
