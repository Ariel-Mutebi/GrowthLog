import * as Y from 'yjs';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TiptapTransformer } from '@hocuspocus/transformer';
import type { JSONContent } from '@tiptap/core';
import type { TestEnv } from '../../test-env.js';

const EXTENSIONS = [StarterKit.configure({ heading: { levels: [2, 3] } }), Image];
const FIELD = 'default';

export const SAMPLE_DOC: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello, world' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'A paragraph with ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
        { type: 'text', text: ' and ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
        { type: 'text', text: ' text.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
      ],
    },
  ],
};

/** What HocusPocus would store in Post.draftContent: the encoded Yjs state of the document. */
export function docToDraftBytes(doc: JSONContent = SAMPLE_DOC): Uint8Array<ArrayBuffer> {
  const ydoc = TiptapTransformer.toYdoc(doc, FIELD, EXTENSIONS);
  // Copy into a fresh Uint8Array: Prisma's Bytes type is Uint8Array<ArrayBuffer>, which Buffer doesn't satisfy.
  return new Uint8Array(Y.encodeStateAsUpdate(ydoc));
}

let seedCounter = 0;

/**
 * Writes a post straight to the database, skipping the draft -> write -> publish lifecycle.
 * Slugs use a `seed-` prefix so they can never collide with the `untitled-NNNN` slugs the API generates.
 */
export function seedDraft(
  env: TestEnv,
  authorId: string,
  over: {
    title?: string;
    published?: boolean;
    deleted?: boolean;
    updatedAt?: Date;
    content?: Uint8Array<ArrayBuffer> | null;
  } = {},
) {
  const n = ++seedCounter;
  return env.app.prisma.post.create({
    data: {
      authorId,
      title: over.title ?? 'Untitled',
      slug: `seed-${n}`,
      draftContent: over.content === undefined ? docToDraftBytes() : over.content,
      ...(over.published && {
        publishedTitle: over.title ?? 'Untitled',
        publishedHook: 'A hook',
        publishedHtml: '<p>Published body</p>',
        publishedAt: new Date(),
        readingTime: 1,
      }),
      deletedAt: over.deleted ? new Date() : null,
      ...(over.updatedAt && { updatedAt: over.updatedAt }),
    },
  });
}
