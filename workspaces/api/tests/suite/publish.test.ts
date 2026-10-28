import { afterEach, describe, expect, vi } from 'vitest';
import * as Y from 'yjs';
import type { JSONContent } from '@tiptap/core';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import { GRACE, SESSION, signedInDevice } from './helpers/user.js';
import { docToDraftBytes, rawDraftBytes, seedDraft, seedImage, setContent } from './helpers/draft.js';

const publishUrl = (id: string) => `/api/me/drafts/${id}/publish`;

const CUID_NOT_FOUND = 'cdoesnotexist'.padEnd(24, '0');
const NOT_FOUND = { error: 'NotFound', message: 'This draft could not be found' };
const UNTITLED = { error: 'UnprocessableEntity', message: 'You cannot publish an untitled post' };
const EMPTY = { error: 'UnprocessableEntity', message: 'You cannot publish an empty post' };
const BAD_COVER = { error: 'UnprocessableEntity', message: 'This cover image is not valid' };
const BAD_IMAGE = { error: 'UnprocessableEntity', message: 'You cannot use externally-hosted images' };
const CONFLICT = { error: 'Conflict', message: 'That url-slug is already in use' };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 30;
const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

const SAFE_TAGS = new Set(['h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'img', 'a', 'br', 'blockquote', 'code', 'pre', 'hr', 's']);
// Matches whole tags, consuming quoted attribute values so a `<script>` that is merely text inside
// alt="..." (legal, inert, and not escaped by the serializer) is not mistaken for a real tag.
const TAG = /<\/?([a-z][a-z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
const tagsIn = (html: string) => [...html.matchAll(TAG)];
const tagNames = (html: string) => tagsIn(html).map((m) => m[1]!.toLowerCase());
const hasEventHandlerAttr = (html: string) =>
  tagsIn(html).some((m) => /\son[a-z]+\s*=/i.test(m[2]!.replace(/"[^"]*"|'[^']*'/g, '""')));

afterEach(() => {
  vi.restoreAllMocks();
});

const storagePrefix = (env: TestEnv) => `${env.app.config.PUBLIC_STORAGE_ENDPOINT}/${env.app.config.PUBLIC_IMAGE_BUCKET}`;
const full = (env: TestEnv, id: string) =>
  env.app.prisma.post.findUniqueOrThrow({ where: { id }, include: { tags: true } });

const textDoc = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const imageDoc = (src: string | null): JSONContent => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Some text' }] },
    { type: 'image', attrs: { src } },
  ],
});

/**
 * An author with a publishable draft (titled, has content, has an uploaded cover) and a valid publish body.
 * The cleaner is stubbed so no real queue or storage is touched; `purge` records calls.
 */
async function setup(
  env: TestEnv,
  user: Partial<Record<string, string>> = {},
  over: { title?: string; content?: Uint8Array<ArrayBuffer> | null } = {},
) {
  const purge = vi.spyOn(env.app.cleaner, 'purgeUnusedImages').mockResolvedValue(undefined as never);
  const { device, id: authorId } = await signedInDevice(env, user);
  const post = await seedDraft(env, authorId, {
    title: over.title ?? 'My post',
    ...(over.content !== undefined && { content: over.content }),
  });
  const coverId = await seedImage(env, post.id);
  const body: Record<string, unknown> = {
    slug: `my-post-${post.id.slice(-6)}`,
    publishedTitle: 'My post',
    publishedHook: 'A short hook',
    coverImageId: coverId,
    tags: ['alpha', 'beta'],
  };
  const publish = (extra: Record<string, unknown> = {}, as: Device = device) =>
    as.post(publishUrl(post.id), { ...body, ...extra });

  /** Asserts a rejected publish changed nothing. */
  const untouched = async () => {
    const after = await full(env, post.id);
    expect(after.publishedAt, 'must still be unpublished').toBeNull();
    expect(after.publishedHtml).toBeNull();
    expect(after.coverImageId).toBeNull();
    expect(after.slug).toBe(post.slug);
    expect(after.title).toBe(post.title);
    expect(after.tags, 'no tags attached').toHaveLength(0);
  };
  return { device, authorId, post, coverId, body, publish, purge, untouched };
}

const expectRejected = (res: LightMyRequestResponse, status: number, message?: object) => {
  expect(res.statusCode, res.body).toBe(status);
  if (message) expect(res.json()).toMatchObject(message);
};

describe('authentication', () => {
  test('publish, prepublish and unpublish all require a session, and change nothing', async ({ env }) => {
    const s = await setup(env);
    const forged = env.device();
    forged.cookies.set(SESSION, 'forged-session-id');

    for (const [label, device] of [['anonymous', env.device()], ['forged', forged]] as const) {
      expect((await device.post(publishUrl(s.post.id), s.body)).statusCode, `${label} publish`).toBe(401);
      expect((await device.get(publishUrl(s.post.id))).statusCode, `${label} prepublish`).toBe(401);
      expect((await device.delete(publishUrl(s.post.id))).statusCode, `${label} unpublish`).toBe(401);
    }
    await s.untouched();
    expect(s.purge).not.toHaveBeenCalled();
  });
});

describe('publishing', () => {
  test('publishes the draft and persists exactly the snapshot, rendered HTML and reading time', async ({ env }) => {
    const s = await setup(env);

    const draftBefore = (await full(env, s.post.id)).draftContent!;
    const res = await s.publish();

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    const saved = await full(env, s.post.id);
    expect(saved.slug).toBe(s.body['slug']);
    expect(saved.publishedTitle).toBe('My post');
    expect(saved.title, 'draft title is kept in sync').toBe('My post');
    expect(saved.publishedHook).toBe('A short hook');
    expect(saved.coverImageId).toBe(s.coverId);
    expect(Number.isInteger(saved.readingTime)).toBe(true);
    expect(saved.readingTime).toBeGreaterThanOrEqual(1);
    expect(Date.now() - saved.publishedAt!.getTime()).toBeLessThan(60_000);
    expect(saved.tags.map((t) => t.name).sort()).toEqual(['alpha', 'beta']);
    expect(saved.authorId).toBe(s.authorId);
    expect(saved.deletedAt).toBeNull();
    expect(saved.publishedHtml).toContain('<h2>Hello, world</h2>');
    expect(saved.publishedHtml).toContain('<strong>bold</strong>');
    expect(Buffer.compare(saved.draftContent!, draftBefore), 'the draft itself is left alone').toBe(0);
    expect(s.purge).toHaveBeenCalledTimes(1);
    expect(s.purge).toHaveBeenCalledWith({ postId: s.post.id });
  });

  test('a published post becomes discoverable through tag search', async ({ env }) => {
    const s = await setup(env);
    expect((await env.device().get('/api/tags?search=alpha')).json(), 'hidden while a draft').toEqual([]);

    await s.publish();

    const res = await env.device().get('/api/tags?search=alpha');
    expect(res.json()).toEqual([expect.objectContaining({ name: 'alpha', postCount: 1 })]);
  });

  test('accepts an empty tag list', async ({ env }) => {
    const s = await setup(env);
    expect((await s.publish({ tags: [] })).statusCode).toBe(204);
    expect((await full(env, s.post.id)).tags).toHaveLength(0);
  });

  test('ignores client-supplied server-owned fields (mass assignment)', async ({ env }) => {
    const { id: otherId } = await signedInDevice(env, GRACE);
    const s = await setup(env);

    const res = await s.publish({
      id: CUID_NOT_FOUND,
      authorId: otherId,
      title: 'hijacked',
      publishedAt: '2000-01-01T00:00:00.000Z',
      publishedHtml: '<script>alert(1)</script>',
      readingTime: 999,
      deletedAt: new Date().toISOString(),
      draftContent: 'x',
    });

    expect(res.statusCode).toBe(400);
    const saved = await full(env, s.post.id);
    expect(saved.id).toBe(s.post.id);
    expect(saved.authorId).toBe(s.authorId);
    expect(saved.deletedAt).toBeNull();
    expect(saved.title).toBe('My post');
    if (res.statusCode === 204) {
      expect(saved.publishedAt!.getFullYear()).toBeGreaterThan(2000);
      expect(saved.publishedHtml, 'HTML is always generated server-side').not.toContain('<script');
      expect(saved.readingTime).not.toBe(999);
    } else {
      await s.untouched();
    }
  });

  test('republishing refreshes the content and does not conflict with its own slug', async ({ env }) => {
    const s = await setup(env);
    expect((await s.publish()).statusCode).toBe(204);

    await setContent(env, s.post.id, docToDraftBytes(textDoc('Edited after publishing')));
    const again = await s.publish({ publishedHook: 'New hook' });

    expect(again.statusCode, 'same author, same slug').toBe(204);
    const saved = await full(env, s.post.id);
    expect(saved.publishedHtml).toContain('Edited after publishing');
    expect(saved.publishedHook).toBe('New hook');
  });

  test('republishing replaces the tag set: removed tags are detached, new ones attached, [] clears all', async ({ env }) => {
    const s = await setup(env);
    const tagsOf = async () => (await full(env, s.post.id)).tags.map((t) => t.name).sort();
    const searchNames = async (term: string) =>
      ((await env.device().get(`/api/tags?search=${term}`)).json() as { name: string }[]).map((t) => t.name);

    await s.publish({ tags: ['alpha', 'beta'] });
    expect(await tagsOf()).toEqual(['alpha', 'beta']);

    // `set: []` plus `connectOrCreate` in one update must end up as exactly the new set, not empty.
    expect((await s.publish({ tags: ['beta', 'gamma'] })).statusCode).toBe(204);
    expect(await tagsOf()).toEqual(['beta', 'gamma']);
    expect(await searchNames('alpha'), 'a detached tag stops being discoverable').toEqual([]);
    expect(await searchNames('gamma')).toEqual(['gamma']);
    expect(await env.app.prisma.tag.count({ where: { name: 'alpha' } }), 'the tag row itself is kept').toBe(1);

    expect((await s.publish({ tags: [] })).statusCode).toBe(204);
    expect(await tagsOf()).toEqual([]);
  });
});

describe('the draft being published', () => {
  test('a missing, someone else\'s or deleted draft is a 404 and nothing is published', async ({ env }) => {
    const s = await setup(env);
    const other = await setup(env, GRACE);
    const deleted = await setup(env, { email: 'third@example.com', username: 'third-user' });
    await env.app.prisma.post.update({ where: { id: deleted.post.id }, data: { deletedAt: new Date() } });

    const missing = await s.device.post(publishUrl(CUID_NOT_FOUND), s.body);
    const theirs = await s.device.post(publishUrl(other.post.id), { ...s.body, coverImageId: other.coverId });
    const gone = await deleted.publish();

    for (const res of [missing, theirs, gone]) expectRejected(res, 404, NOT_FOUND);
    await other.untouched();
    expect((await full(env, deleted.post.id)).publishedAt).toBeNull();
  });

  test('malformed ids are a clean 4xx, never a 5xx', async ({ env }) => {
    const s = await setup(env);
    for (const id of ['nonexistent', '%00', '%27%20OR%20%271%27%3D%271', '..%2Fusers', '0', 'a'.repeat(500)]) {
      const res = await s.device.post(`/api/drafts/${id}/publish`, s.body);
      expect([400, 404], `${id} -> ${res.statusCode}`).toContain(res.statusCode);
    }
  });

  test('the published title cannot be "Untitled" or blank', async ({ env }) => {
    const s = await setup(env);

    expectRejected(await s.publish({ publishedTitle: 'Untitled' }), 422, UNTITLED);
    const blank = await s.publish({ publishedTitle: '   ' });
    expect([400, 422], `blank title -> ${blank.statusCode}`).toContain(blank.statusCode);

    await s.untouched();
    expect(s.purge).not.toHaveBeenCalled();
  });

  test('a draft with no content, or an empty document, cannot be published', async ({ env }) => {
    const cases = [
      null,
      docToDraftBytes({ type: 'doc', content: [{ type: 'paragraph' }] }),
      docToDraftBytes(textDoc('   ')), // whitespace only
      docToDraftBytes({ type: 'doc', content: [{ type: 'horizontalRule' }] }), // structure but no content
      rawDraftBytes(() => {}),
    ];
    for (const [i, content] of cases.entries()) {
      const s = await setup(env, { email: `e${i}@example.com`, username: `empty-${i}` }, { content });
      expectRejected(await s.publish(), 422, EMPTY);
      await s.untouched();
    }
  });

  // The real flow: a draft is created as "Untitled" and the publish form is where the title gets chosen.
  test('a draft still named "Untitled" publishes once the publish form gives it a real title', async ({ env }) => {
    const s = await setup(env, {}, { title: 'Untitled' });

    const res = await s.publish({ publishedTitle: 'A real title' });

    expect(res.statusCode, res.body).toBe(204);
    const saved = await full(env, s.post.id);
    expect(saved.publishedTitle).toBe('A real title');
    expect(saved.title).toBe('A real title');
  });
});

describe('cover image', () => {
  test('must be an UPLOADED image attached to this very post', async ({ env }) => {
    const s = await setup(env);
    const sibling = await seedDraft(env, s.authorId, { title: 'Sibling' });
    const siblingImage = await seedImage(env, sibling.id);
    const other = await setup(env, GRACE);
    const pending = await seedImage(env, s.post.id, 'PENDING');

    const cases: Record<string, string> = {
      'does not exist': CUID_NOT_FOUND,
      'belongs to the author\'s other post': siblingImage,
      'belongs to someone else\'s post': other.coverId,
      'is not uploaded yet': pending,
    };
    for (const [label, coverImageId] of Object.entries(cases)) {
      const res = await s.publish({ coverImageId });
      expect(res.statusCode, `cover image that ${label}: ${res.body}`).toBe(422);
      expect(res.json()).toMatchObject(BAD_COVER);
    }
    await s.untouched();
    expect((await full(env, sibling.id)).coverImageId, 'the other post must not gain a cover').toBeNull();
  });
});

describe('slug', () => {
  test('is unique across all users and a conflict changes nothing', async ({ env }) => {
    const a = await setup(env);
    const b = await setup(env, GRACE);
    await a.publish();
    a.purge.mockClear(); // the cleaner stub is shared by both setups
    const tagsBefore = await env.app.prisma.tag.count();

    const res = await b.publish({ slug: a.body['slug'], tags: ['brandnewtag'] });

    expectRejected(res, 409, CONFLICT);
    await b.untouched();
    expect(await env.app.prisma.tag.count(), 'a failed publish must not create tags').toBe(tagsBefore);
    expect((await full(env, a.post.id)).publishedTitle, 'the owner is untouched').toBe('My post');
    expect(b.purge, 'nothing to clean up after a failed publish').not.toHaveBeenCalled();
  });

  test('also conflicts with unpublished drafts and with the author\'s own other posts', async ({ env }) => {
    const a = await setup(env);
    const b = await setup(env, GRACE);
    const own = await seedDraft(env, b.authorId, { title: 'Another' });

    expectRejected(await b.publish({ slug: a.post.slug }), 409, CONFLICT);
    expectRejected(await b.publish({ slug: own.slug }), 409, CONFLICT);
    await b.untouched();
  });

  test('two simultaneous publishes of the same slug have exactly one winner and no 5xx', async ({ env }) => {
    const a = await setup(env);
    const b = await setup(env, GRACE);

    const [ra, rb] = await Promise.all([a.publish({ slug: 'race-slug' }), b.publish({ slug: 'race-slug' })]);

    expect([ra.statusCode, rb.statusCode].sort()).toEqual([204, 409]);
    expect(await env.app.prisma.post.count({ where: { slug: 'race-slug' } })).toBe(1);
  });

  test('accepts lowercase words joined by single hyphens, up to the length cap', async ({ env }) => {
    const s = await setup(env);
    for (const slug of ['a', 'a1', '404', '2024-recap', 'my-post-123', 'a-b-c-d', 'a'.repeat(SLUG_MAX)]) {
      const res = await s.publish({ slug });
      expect(res.statusCode, `slug ${slug}: ${res.body}`).toBe(204);
      expect((await full(env, s.post.id)).slug).toBe(slug);
    }
  });

  test('rejects anything else: URL-unsafe characters, uppercase, bad hyphens, non-ASCII, too long', async ({ env }) => {
    const s = await setup(env);
    const invalid = [
      '', 'a/b', 'a\\b', 'a b', 'a?b', 'a#b', 'a%2Fb', '..', '.', '<script>', 'a\nb', 'a\u0000b',
      'My-Post', 'MY', '-a', 'a-', 'a--b', 'a_b', 'a.b', 'café', '日本語', '😀',
      'a'.repeat(SLUG_MAX + 1), 'a'.repeat(500),
    ];
    for (const slug of invalid) {
      const res = await s.publish({ slug });
      expect(res.statusCode, `slug ${JSON.stringify(slug).slice(0, 40)}`).toBe(400);
    }
    await s.untouched();
  });
});

describe('request body', () => {
  test('requires every field', async ({ env }) => {
    const s = await setup(env);
    for (const key of ['slug', 'publishedTitle', 'publishedHook', 'coverImageId', 'tags']) {
      expect((await s.publish({ [key]: undefined })).statusCode, `missing ${key}`).toBe(400);
    }
    expect((await s.device.post(publishUrl(s.post.id))).statusCode, 'no body at all').toBe(400);
    await s.untouched();
  });

  test('rejects an invalid cover image id format', async ({ env }) => {
    const s = await setup(env);
    for (const coverImageId of ['', 'not-a-cuid', '%00', '\' OR 1=1 --', 'c'.repeat(500)]) {
      expect((await s.publish({ coverImageId })).statusCode, coverImageId).toBe(400);
    }
  });
});

describe('tags', () => {
  test('rejects invalid tag values with 400', async ({ env }) => {
    const s = await setup(env);
    const tagsBefore = await env.app.prisma.tag.count();
    for (const tags of [['Alpha'], ['a b'], ['a'.repeat(26)], [''], ['<script>'], ['\'; DROP TABLE "Tag";'], [null], [{}]]) {
      expect((await s.publish({ tags })).statusCode, JSON.stringify(tags)).toBe(400);
    }
    expect(await env.app.prisma.tag.count()).toBe(tagsBefore);
    await s.untouched();
  });

  test('duplicate tags in the request are collapsed, not an error', async ({ env }) => {
    const s = await setup(env);

    const res = await s.publish({ tags: ['alpha', 'alpha', 'beta'] });

    expect(res.statusCode).toBe(204);
    expect((await full(env, s.post.id)).tags.map((t) => t.name).sort()).toEqual(['alpha', 'beta']);
  });

  test('reuses an existing tag instead of creating a duplicate', async ({ env }) => {
    const existing = await env.app.prisma.tag.create({ data: { name: 'alpha' } });
    const s = await setup(env);

    await s.publish({ tags: ['alpha'] });

    expect(await env.app.prisma.tag.count({ where: { name: 'alpha' } })).toBe(1);
    expect((await full(env, s.post.id)).tags.map((t) => t.id)).toEqual([existing.id]);
  });

  test('allows up to 10 tags and rejects more without creating any', async ({ env }) => {
    const s = await setup(env);
    const make = (n: number) => Array.from({ length: n }, (_, i) => `tag${i}`);

    for (const n of [11, 1_000]) {
      expect((await s.publish({ tags: make(n) })).statusCode, `${n} tags`).toBe(400);
    }
    expect(await env.app.prisma.tag.count(), 'a rejected request must not create tags').toBe(0);

    expect((await s.publish({ tags: make(10) })).statusCode).toBe(204);
    expect((await full(env, s.post.id)).tags).toHaveLength(10);
  });
});

describe('content safety', () => {
  test('hostile text, attributes and links are neutralised in the published HTML', async ({ env }) => {
    const s = await setup(env);
    const src = `${storagePrefix(env)}/${s.post.id}/pic.webp`;
    await setContent(
      env,
      s.post.id,
      docToDraftBytes({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script> <img src=x onerror=alert(1)>' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
          { type: 'image', attrs: { src, alt: '"><script>alert(1)</script>', title: '\' onmouseover=\'alert(1)' } },
        ],
      }),
    );

    const res = await s.publish();

    expect(res.statusCode).toBe(204);
    const html = (await full(env, s.post.id)).publishedHtml!;
    expect(tagNames(html).filter((t) => !SAFE_TAGS.has(t)), 'only editor-schema tags may be emitted').toEqual([]);
    expect(html).not.toMatch(/href="\s*javascript:/i);
    expect(hasEventHandlerAttr(html), 'no on* event-handler attributes on any tag').toBe(false);
  });

  test('a document the editor could never produce (written straight to Yjs) is rejected or sanitised, never a 5xx', async ({ env }) => {
    const s = await setup(env);
    await setContent(
      env,
      s.post.id,
      rawDraftBytes((fragment) => {
        const p = new Y.XmlElement('paragraph');
        p.insert(0, [new Y.XmlText('hello')]);
        const iframe = new Y.XmlElement('iframe');
        iframe.setAttribute('src', 'https://evil.example');
        fragment.insert(0, [p, iframe]);
      }),
    );

    const res = await s.publish();

    expect(res.statusCode, res.body).toBeLessThan(500);
    if (res.statusCode === 204) {
      expect((await full(env, s.post.id)).publishedHtml).not.toMatch(/<iframe/i);
    } else {
      await s.untouched();
    }
  });

  test('corrupt draft bytes are a clean 4xx, not a 5xx', async ({ env }) => {
    const s = await setup(env);
    await setContent(env, s.post.id, new Uint8Array([255, 255, 255, 255, 1, 2, 3]));

    const res = await s.publish();

    expect([400, 422], res.body).toContain(res.statusCode);
    await s.untouched();
  });
});

describe('inline images', () => {
  test('accepts images hosted under this post\'s own storage prefix and keeps them in the HTML', async ({ env }) => {
    const s = await setup(env);
    const src = `${storagePrefix(env)}/${s.post.id}/pic.webp`;
    await setContent(env, s.post.id, docToDraftBytes(imageDoc(src)));

    expect((await s.publish()).statusCode).toBe(204);

    expect((await full(env, s.post.id)).publishedHtml).toContain(src);
  });

  test('a post that is only an image counts as having content', async ({ env }) => {
    const s = await setup(env);
    const src = `${storagePrefix(env)}/${s.post.id}/pic.webp`;
    await setContent(env, s.post.id, docToDraftBytes({ type: 'doc', content: [{ type: 'image', attrs: { src } }] }));

    expect((await s.publish()).statusCode).toBe(204);
  });

  test('rejects images from anywhere else, including prefix tricks', async ({ env }) => {
    const s = await setup(env);
    const own = `${storagePrefix(env)}/${s.post.id}`;
    const hostile = [
      'https://evil.example/x.png',
      'http://evil.example/x.png',
      '//evil.example/x.png',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'javascript:alert(1)',
      `${storagePrefix(env)}/${CUID_NOT_FOUND}/x.webp`, // another post's folder
      // Exploitable today: startsWith() passes, but browsers resolve ".." into another post's folder.
      `${own}/../${CUID_NOT_FOUND}/x.webp`,
      `${own}/%2e%2e/${CUID_NOT_FOUND}/x.webp`,
      // Hardening: harmless today, but they only pass because the prefix has no trailing slash.
      `${own}x/pic.webp`,
      `${own}@evil.example/x.webp`,
    ];
    for (const src of hostile) {
      await setContent(env, s.post.id, docToDraftBytes(imageDoc(src)));
      const res = await s.publish();
      expect(res.statusCode, `${src} -> ${res.statusCode}`).toBe(422);
      expect(res.json()).toMatchObject(BAD_IMAGE);
    }
    await s.untouched();
  });

  test('an image with no src is rejected cleanly', async ({ env }) => {
    const s = await setup(env);
    await setContent(env, s.post.id, docToDraftBytes(imageDoc(null)));

    const res = await s.publish();

    expect([400, 422], res.body).toContain(res.statusCode);
    await s.untouched();
  });
});

describe('post-publish cleanup', () => {
  test('image cleanup only runs after the post is committed as published', async ({ env }) => {
    const s = await setup(env);
    let publishedAtWhenPurged: Date | null | undefined;
    s.purge.mockImplementation((async () => {
      publishedAtWhenPurged = (await full(env, s.post.id)).publishedAt;
    }) as never);

    await s.publish();

    expect(publishedAtWhenPurged, 'purge must not race ahead of the write').toBeInstanceOf(Date);
  });

});

describe('prepublish and unpublish', () => {
  test('prepublish gives sensible defaults even for a brand-new empty draft', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const draft = await seedDraft(env, id, { content: null });

    const res = await device.get(publishUrl(draft.id));

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ publishedTitle: 'Untitled', coverImageId: null, coverImageKey: null });
    expect(res.json().slug).toMatch(/^untitled-\d{4}$/);
  });

  test('prepublish of a missing, someone else\'s or soft-deleted draft is a 404 and leaks nothing', async ({ env }) => {
    const a = await signedInDevice(env);
    const b = await signedInDevice(env, GRACE);
    const theirs = await seedDraft(env, b.id, { title: 'Their secret' });
    const deleted = await seedDraft(env, a.id, { title: 'Deleted one', deleted: true });

    for (const id of [CUID_NOT_FOUND, theirs.id, deleted.id]) {
      const res = await a.device.get(publishUrl(id));
      expect(res.statusCode, id).toBe(404);
      expect(res.body).not.toMatch(/Their secret|Deleted one/);
    }
  });

  test('unpublish of someone else\'s post does nothing', async ({ env }) => {
    const a = await signedInDevice(env);
    const b = await signedInDevice(env, GRACE);
    const theirs = await seedDraft(env, b.id, { published: true });

    const res = await a.device.delete(publishUrl(theirs.id));

    expect(res.statusCode).toBe(204);
    expect((await full(env, theirs.id)).publishedAt, 'still published').not.toBeNull();
  });

  test('unpublish hides the post from tag search and is idempotent', async ({ env }) => {
    const s = await setup(env);
    await s.publish();
    expect((await env.device().get('/api/tags?search=alpha')).json()).toHaveLength(1);

    expect((await s.device.delete(publishUrl(s.post.id))).statusCode).toBe(204);
    expect((await s.device.delete(publishUrl(s.post.id))).statusCode).toBe(204);

    expect((await full(env, s.post.id)).publishedAt).toBeNull();
    expect((await env.device().get('/api/tags?search=alpha')).json()).toEqual([]);
  });
});

describe('reading time', () => {
  const paragraphsDoc = (counts: number[]): JSONContent => ({
    type: 'doc',
    content: counts.map((n) => ({ type: 'paragraph', content: [{ type: 'text', text: words(n) }] })),
  });

  test('is ceil(words / 238) across the whole document, and never below 1', async ({ env }) => {
    const s = await setup(env);
    const cases: [number[], number][] = [
      [[1], 1],
      [[238], 1],
      [[239], 2],
      [[476], 2],
      [[477], 3],
      [[119, 119], 1], // 238 words split over two paragraphs
      [[120, 119], 2], // 239 words
    ];
    for (const [counts, minutes] of cases) {
      await setContent(env, s.post.id, docToDraftBytes(paragraphsDoc(counts)));
      expect((await s.publish()).statusCode).toBe(204);
      expect((await full(env, s.post.id)).readingTime, `paragraphs of ${counts.join('+')} words`).toBe(minutes);
    }
  });
});

describe('prepublish defaults', () => {
  type Defaults = { slug: string; publishedTitle: string; publishedHook: string };

  async function defaultsFor(
    env: TestEnv,
    device: Device,
    authorId: string,
    title: string,
    content: Uint8Array<ArrayBuffer> | null,
  ) {
    const draft = await seedDraft(env, authorId, { title, content });
    const res = await device.get(publishUrl(draft.id));
    expect(res.statusCode, res.body).toBe(200);
    return res.json() as Defaults;
  }

  const t = (text: string, bold = false): JSONContent => ({ type: 'text', text, ...(bold && { marks: [{ type: 'bold' }] }) });
  const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
  const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

  async function hooks(env: TestEnv) {
    const { device, id } = await signedInDevice(env);
    return async (document: JSONContent) =>
      (await defaultsFor(env, device, id, 'My post', docToDraftBytes(document))).publishedHook;
  }

  test('the default hook is the first non-empty top-level paragraph', async ({ env }) => {
    const hook = await hooks(env);

    expect(await hook(doc({ type: 'heading', attrs: { level: 2 }, content: [t('A heading')] }, { type: 'paragraph' }, p(t('Real intro'))))).toBe('Real intro');
    expect(await hook(doc({ type: 'horizontalRule' }))).toBe('');
  });

  test('the default hook collapses all runs of whitespace', async ({ env }) => {
    const hook = await hooks(env);
    expect(await hook(doc(p(t('one  two   three'))))).toBe('one two three');
  });

  test('the default hook does not split words where formatting changes mid-word', async ({ env }) => {
    const hook = await hooks(env);
    expect(await hook(doc(p(t('Super'), t('cali', true), t('fragilistic'))))).toBe('Supercalifragilistic');
  });

  test('a long default hook is cut at a word boundary and ends with an ellipsis', async ({ env }) => {
    const hook = await hooks(env);

    const result = await hook(doc(p(t(words(50)))));

    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(121);
    expect(result.slice(0, -1), 'no partial word').toMatch(/^word( word)*$/);
  });

  test('a long unbroken string cannot produce an over-long default hook', async ({ env }) => {
    const hook = await hooks(env);

    const result = await hook(doc(p(t('a'.repeat(300)))));

    expect(result.length, 'a pasted URL or long token must still respect the hook limit').toBeLessThanOrEqual(121);
  });

  test('the default slug always satisfies the publish slug rules', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const titles = [
      'Untitled', 'What\'s up!', 'Hello, World!', 'C++ & Rust', 'Café déjà vu', 'a_b.c~d',
      '--dashes--', '100% legit', '   spaced   ',
    ];

    for (const title of titles) {
      const { slug } = await defaultsFor(env, device, id, title, null);
      expect(slug, `title ${JSON.stringify(title)}`).toMatch(SLUG_PATTERN);
      expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    }
  });
});
