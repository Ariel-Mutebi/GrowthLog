import { describe, expect } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import { ALAN, GRACE, deleteAccount, signedInDevice } from './helpers/user.js';
import { seedDraft, seedImage } from './helpers/draft.js';

type Person = Awaited<ReturnType<typeof signedInDevice>>;

/* -------------------------------------------------------------------------- */
/*  Requests                                                                  */
/* -------------------------------------------------------------------------- */

const getFeed = (d: Device) => d.get('/api/posts');
const readPost = (d: Device, slug: string) => d.get(`/api/posts/${slug}`);

const likePost = (d: Device, postId: string) => d.put(`/api/posts/${postId}/likes`);
const unlikePost = (d: Device, postId: string) => d.delete(`/api/posts/${postId}/likes`);
const viewPost = (d: Device, postId: string, type: unknown = 'OPENED') =>
  d.post(`/api/posts/${postId}/views`, { type });

const getComments = (d: Device, postId: string, query = '') =>
  d.get(`/api/posts/${postId}/comments${query}`);
const makeComment = (d: Device, postId: string, text: unknown = 'Nice post') =>
  d.post(`/api/posts/${postId}/comments`, { text });

const commentUrl = (postId: string, commentId: string) => `/api/posts/${postId}/comments/${commentId}`;
const getReplies = (d: Device, postId: string, commentId: string, query = '') =>
  d.get(`${commentUrl(postId, commentId)}/replies${query}`);
const replyTo = (d: Device, postId: string, commentId: string, text: unknown = 'A reply') =>
  d.post(`${commentUrl(postId, commentId)}/replies`, { text });
const editComment = (d: Device, postId: string, commentId: string, text: unknown = 'Edited') =>
  d.patch(commentUrl(postId, commentId), { text });
const deleteComment = (d: Device, postId: string, commentId: string) =>
  d.delete(commentUrl(postId, commentId));
const likeComment = (d: Device, postId: string, commentId: string) =>
  d.put(`${commentUrl(postId, commentId)}/likes`);
const unlikeComment = (d: Device, postId: string, commentId: string) =>
  d.delete(`${commentUrl(postId, commentId)}/likes`);

const follow = (d: Device, userId: string) => d.put(`/api/follow/${userId}`);

/* -------------------------------------------------------------------------- */
/*  Seeding                                                                   */
/*                                                                            */
/*  There is no "create post" endpoint in the routes under test, so posts,    */
/*  tags and comments are seeded straight through Prisma. If the schema       */
/*  differs from what is assumed here (cover/image shape, required columns),  */
/*  this is the only section that needs adjusting.                            */
/* -------------------------------------------------------------------------- */

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const UNKNOWN_ID = 'cdoesnotexist'.padEnd(24, '0');

interface PostOptions {
  tags?: { id: string }[];
  /** `null` makes it a draft; omitted means published now. */
  publishedAt?: Date | null;
  /** Any non-null value soft-deletes the post (seedDraft stamps it with the current time). */
  deletedAt?: Date | null;
  readingTime?: number;
  title?: string;
}

async function createTag(env: TestEnv, name: string) {
  return env.app.prisma.tag.create({ data: { name } });
}

/**
 * Builds on seedDraft (which sets the published* columns but no cover, tags or custom dates).
 * Post.coverImageId references PostImage.imageId, and seedImage returns the Image id, which is that same id.
 */
async function createPost(env: TestEnv, author: Person, o: PostOptions = {}) {
  const published = o.publishedAt !== null;
  const post = await seedDraft(env, author.id, {
    ...(o.title !== undefined && { title: o.title }),
    published,
    deleted: o.deletedAt != null,
  });

  const imageId = await seedImage(env, post.id);

  return env.app.prisma.post.update({
    where: { id: post.id },
    data: {
      coverImageId: imageId,
      tags: { connect: (o.tags ?? []).map(({ id }) => ({ id })) },
      ...(published && {
        publishedAt: o.publishedAt ?? new Date(),
        readingTime: o.readingTime ?? 3,
      }),
    },
  });
}

interface CommentOptions {
  text?: string;
  parentId?: string | null;
  createdAt?: Date;
  deletedAt?: Date | null;
}

async function seedComment(env: TestEnv, postId: string, by: Person, o: CommentOptions = {}) {
  return env.app.prisma.comment.create({
    data: {
      postId,
      commenterId: by.id,
      text: o.text ?? 'Seeded comment',
      parentId: o.parentId ?? null,
      ...(o.createdAt && { createdAt: o.createdAt }),
      deletedAt: o.deletedAt ?? null,
    },
  });
}

const addOnboardingInterest = (env: TestEnv, user: Person, tag: { id: string }, createdAt?: Date) =>
  env.app.prisma.onboardingInterest.create({
    data: { userId: user.id, tagId: tag.id, ...(createdAt && { createdAt }) },
  });

async function people(env: TestEnv) {
  const ada = await signedInDevice(env);
  const grace = await signedInDevice(env, GRACE);
  const alan = await signedInDevice(env, ALAN);
  return { ada, grace, alan };
}

/* -------------------------------------------------------------------------- */
/*  Assertions helpers                                                        */
/* -------------------------------------------------------------------------- */

const idsOf = (res: LightMyRequestResponse) => (res.json() as { id: string }[]).map((x) => x.id);

/** Everything the mutating routes could touch, for "nothing changed" assertions. */
async function snapshot(env: TestEnv) {
  const { prisma } = env.app;
  return {
    likes: await prisma.like.count(),
    commentLikes: await prisma.commentLike.count(),
    views: await prisma.view.count(),
    comments: (await prisma.comment.findMany({ orderBy: { id: 'asc' } })).map((c) => ({
      id: c.id,
      text: c.text,
      deletedAt: c.deletedAt,
    })),
  };
}

/** Well-formed cuid2s are the only ids that may reach the database; none of these are. */
const MALFORMED_IDS = [
  'not-a-cuid',
  'x\'; DROP TABLE "User"; --',
  '5488d11e-c932-4da9-92f2-7f3f19b7fcb1', // a UUID
  'cjld2cjxh0000qzrmn831i7rn', // a cuid v1
];

/** Every id-bearing route. `auth` marks the ones that need a session. */
const routes = [
  { name: 'GET /comments', auth: false, call: (d: Device, p: string) => getComments(d, p) },
  { name: 'POST /comments', auth: true, call: (d: Device, p: string) => makeComment(d, p) },
  { name: 'PUT /likes', auth: true, call: (d: Device, p: string) => likePost(d, p) },
  { name: 'DELETE /likes', auth: true, call: (d: Device, p: string) => unlikePost(d, p) },
  { name: 'POST /views', auth: true, call: (d: Device, p: string) => viewPost(d, p) },
  { name: 'GET /replies', auth: false, call: (d: Device, p: string, c: string) => getReplies(d, p, c) },
  { name: 'POST /replies', auth: true, call: (d: Device, p: string, c: string) => replyTo(d, p, c) },
  { name: 'PATCH comment', auth: true, call: (d: Device, p: string, c: string) => editComment(d, p, c) },
  { name: 'DELETE comment', auth: true, call: (d: Device, p: string, c: string) => deleteComment(d, p, c) },
  { name: 'PUT comment likes', auth: true, call: (d: Device, p: string, c: string) => likeComment(d, p, c) },
  { name: 'DELETE comment likes', auth: true, call: (d: Device, p: string, c: string) => unlikeComment(d, p, c) },
];

/* -------------------------------------------------------------------------- */
/*  Cross-cutting                                                             */
/* -------------------------------------------------------------------------- */

describe('authentication', () => {
  test.for(routes.filter((r) => r.auth))(
    '$name requires a session and changes nothing',
    async ({ call }, { env }) => {
      const { ada, grace } = await people(env);
      const post = await createPost(env, grace);
      const comment = await seedComment(env, post.id, grace);
      await likePost(ada.device, post.id);
      await likeComment(ada.device, post.id, comment.id);
      const before = await snapshot(env);

      const res = await call(env.device(), post.id, comment.id);

      expect(res.statusCode, res.body).toBe(401);
      expect(await snapshot(env), 'database must be untouched').toEqual(before);
    },
  );

  test.for(routes.filter((r) => !r.auth))('$name needs no session', async ({ call }, { env }) => {
    const { grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);

    const res = await call(env.device(), post.id, comment.id);

    expect(res.statusCode, res.body).toBe(200);
  });
});

describe('malformed ids', () => {
  test.for(MALFORMED_IDS)('the malformed id %s is rejected with 400 as a post id and a comment id', async (raw, { env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);
    const bad = encodeURIComponent(raw);
    const before = await snapshot(env);

    for (const { name, call } of routes) {
      expect((await call(ada.device, bad, comment.id)).statusCode, `${name} (bad postId)`).toBe(400);
    }
    for (const { name, call } of routes.slice(5)) {
      expect((await call(ada.device, post.id, bad)).statusCode, `${name} (bad commentId)`).toBe(400);
    }
    expect(await snapshot(env)).toEqual(before);
  });
});

describe('hostile path segments', () => {
  // Raw, already-encoded segments (same list as the draft suite). Ids must be well-formed cuid2s, so every id
  // route answers with a clean 4xx; the slug route accepts any string, so it must answer 404 rather than 500.
  const HOSTILE_SEGMENTS = [
    '%00',
    'a%00b',
    '%27%20OR%20%271%27%3D%271',
    '%27%3B%20DROP%20TABLE%20%22Post%22%3B%20--',
    '..%2F..%2Fusers',
    '%2F',
    '%25',
    '%E0%A4%A',
    '0',
    'null',
    'undefined',
    'a'.repeat(500),
  ];
  const LEAK = /prisma|postgres|invalid byte|node_modules|\bat .*:\d+:\d+/i;

  test('never cause a 5xx on any route and never alter data', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);
    const before = await snapshot(env);

    for (const seg of HOSTILE_SEGMENTS) {
      const label = seg.slice(0, 40);
      // The first five routes only take a post id; the rest also take a comment id.
      const responses: [string, Promise<LightMyRequestResponse>][] = [
        ...routes.map(({ name, call }): [string, Promise<LightMyRequestResponse>] =>
          [`${name} (post id)`, call(ada.device, seg, comment.id)]),
        ...routes.slice(5).map(({ name, call }): [string, Promise<LightMyRequestResponse>] =>
          [`${name} (comment id)`, call(ada.device, post.id, seg)]),
        ['GET /:slug', readPost(ada.device, seg)],
      ];

      for (const [name, pending] of responses) {
        const res = await pending;
        expect(res.statusCode, `${name} ${label} -> ${res.statusCode}`).toBeGreaterThanOrEqual(400);
        expect(res.statusCode, `${name} ${label} -> ${res.statusCode}`).toBeLessThan(500);
        expect(res.body, `${name} ${label}`).not.toMatch(LEAK);
      }
    }

    expect(await snapshot(env)).toEqual(before);
  });
});

describe('ids that match nothing', () => {
  test('liking, viewing or commenting on a post that does not exist is a 404, not a 500', async ({ env }) => {
    const { ada } = await people(env);

    expect((await likePost(ada.device, UNKNOWN_ID)).statusCode, 'PUT likes').toBe(404);
    expect((await viewPost(ada.device, UNKNOWN_ID)).statusCode, 'POST views').toBe(404);
    expect((await makeComment(ada.device, UNKNOWN_ID)).statusCode, 'POST comments').toBe(404);
    expect(await snapshot(env)).toMatchObject({ likes: 0, views: 0, comments: [] });
  });

  test('unliking a post that does not exist is idempotent', async ({ env }) => {
    const { ada } = await people(env);

    expect((await unlikePost(ada.device, UNKNOWN_ID)).statusCode).toBe(204);
  });

  test('listing comments of an unknown post returns an empty list', async ({ env }) => {
    const res = await getComments(env.device(), UNKNOWN_ID);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('acting on a comment that does not exist is a 404, not a 500', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    expect((await likeComment(ada.device, post.id, UNKNOWN_ID)).statusCode, 'like').toBe(404);
    expect((await editComment(ada.device, post.id, UNKNOWN_ID)).statusCode, 'edit').toBe(404);
    expect((await deleteComment(ada.device, post.id, UNKNOWN_ID)).statusCode, 'delete').toBe(404);
    expect((await replyTo(ada.device, post.id, UNKNOWN_ID)).statusCode, 'reply').toBe(404);
  });
});

/* -------------------------------------------------------------------------- */
/*  GET /api/posts/:slug                                                      */
/* -------------------------------------------------------------------------- */

describe('GET /api/posts/:slug (read)', () => {
  test('returns the published content with its metadata, to anyone', async ({ env }) => {
    const { grace, alan } = await people(env);
    const post = await createPost(env, grace, { title: 'On compilers', readingTime: 7 });
    await likePost(alan.device, post.id);
    await makeComment(alan.device, post.id);
    await makeComment(grace.device, post.id);

    const res = await readPost(env.device(), post.slug);

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({
      id: post.id,
      title: 'On compilers',
      publishedHtml: post.publishedHtml,
      readingTime: 7,
      coverKey: expect.stringContaining(post.id),
      likes: 1,
      comments: 2,
      author: { id: grace.id, forename: 'Grace', surname: 'Hopper', avatarKey: null },
    });
    expect(res.json().publishedAt).toBeTruthy();
  });

  test('exposes only public author fields', async ({ env }) => {
    const { grace } = await people(env);
    const post = await createPost(env, grace);

    const { author } = (await readPost(env.device(), post.slug)).json();

    for (const secret of ['email', 'password', 'deletedAt', 'avatarId', 'avatar']) {
      expect(author, `"${secret}" must not be exposed`).not.toHaveProperty(secret);
    }
  });

  test('returns 404 for an unknown slug', async ({ env }) => {
    const res = await readPost(env.device(), 'no-such-post');

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'NotFound' });
  });

  test('returns 404 for a draft (never published)', async ({ env }) => {
    const { grace } = await people(env);
    const draft = await createPost(env, grace, { publishedAt: null });

    expect((await readPost(env.device(), draft.slug)).statusCode).toBe(404);
  });

  test('returns 404 for a soft-deleted post', async ({ env }) => {
    const { grace } = await people(env);
    const post = await createPost(env, grace, { deletedAt: new Date() });

    expect((await readPost(env.device(), post.slug)).statusCode).toBe(404);
  });

  // The feed hides posts by deleted authors, and a deleted user's profile is a 404.
  test('returns 404 for a post whose author deleted their account', async ({ env }) => {
    const { grace } = await people(env);
    const post = await createPost(env, grace);
    await deleteAccount(grace.device);

    expect((await readPost(env.device(), post.slug)).statusCode).toBe(404);
  });
});

/* -------------------------------------------------------------------------- */
/*  Likes                                                                     */
/* -------------------------------------------------------------------------- */

describe('PUT/DELETE /api/posts/:postId/likes', () => {
  test('like adds one like owned by the caller and is reflected in the read count', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    const res = await likePost(ada.device, post.id);

    expect(res.statusCode).toBe(204);
    expect(res.body, '204 must have an empty body').toBe('');
    const rows = await env.app.prisma.like.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: ada.id, postId: post.id });
    expect((await readPost(env.device(), post.slug)).json().likes).toBe(1);
  });

  // Races the upsert's check-then-insert. Prisma upserts can surface a P2002 under concurrency.
  test('parallel duplicate likes all succeed and store one like', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    const responses = await Promise.all(Array.from({ length: 10 }, () => likePost(ada.device, post.id)));

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(204));
    expect(await env.app.prisma.like.count()).toBe(1);
  });

  test('several users can like the same post', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const post = await createPost(env, grace);

    await likePost(ada.device, post.id);
    await likePost(alan.device, post.id);

    expect((await readPost(env.device(), post.slug)).json().likes).toBe(2);
  });

  test('unlike removes only the caller\'s like', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const post = await createPost(env, grace);
    const other = await createPost(env, grace);
    await likePost(ada.device, post.id);
    await likePost(alan.device, post.id);
    await likePost(ada.device, other.id);

    const res = await unlikePost(ada.device, post.id);

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    const rows = await env.app.prisma.like.findMany();
    expect(rows.map((r) => `${r.userId}>${r.postId}`).sort()).toEqual(
      [`${alan.id}>${post.id}`, `${ada.id}>${other.id}`].sort(),
    );
  });

  test('is idempotent: unliking a post you never liked succeeds', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    expect((await unlikePost(ada.device, post.id)).statusCode).toBe(204);
  });

  test('parallel duplicate unlikes all succeed', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    await likePost(ada.device, post.id);

    const responses = await Promise.all(Array.from({ length: 10 }, () => unlikePost(ada.device, post.id)));

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(204));
    expect(await env.app.prisma.like.count()).toBe(0);
  });

  test('can like again after unliking', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    await likePost(ada.device, post.id);
    await unlikePost(ada.device, post.id);

    expect((await likePost(ada.device, post.id)).statusCode).toBe(204);
    expect(await env.app.prisma.like.count()).toBe(1);
  });

  test('authors may like their own post', async ({ env }) => {
    const { grace } = await people(env);
    const post = await createPost(env, grace);

    expect((await likePost(grace.device, post.id)).statusCode).toBe(204);
  });
});

/* -------------------------------------------------------------------------- */
/*  Views                                                                     */
/* -------------------------------------------------------------------------- */

describe('POST /api/posts/:postId/views', () => {
  test.for(['OPENED', 'READ'] as const)('records a %s view for the caller', async (type, { env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    const res = await viewPost(ada.device, post.id, type);

    expect(res.statusCode, res.body).toBe(204);
    expect(res.body, '204 must have an empty body').toBe('');
    const rows = await env.app.prisma.view.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: ada.id, postId: post.id, type });
  });

  test('a reader typically sends OPENED and then READ; both are stored', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    expect((await viewPost(ada.device, post.id, 'OPENED')).statusCode).toBe(204);
    expect((await viewPost(ada.device, post.id, 'READ')).statusCode).toBe(204);

    expect((await env.app.prisma.view.findMany()).map((v) => v.type).sort()).toEqual(['OPENED', 'READ']);
  });

  // The client may re-open a post or retry; this must never become a 500.
  test('re-opening the same post does not fail', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    const first = await viewPost(ada.device, post.id, 'OPENED');
    const second = await viewPost(ada.device, post.id, 'OPENED');

    expect(first.statusCode).toBe(204);
    expect(second.statusCode, second.body).toBe(204);
  });

  test.for([
    { label: 'unknown type', body: { type: 'SKIMMED' } },
    { label: 'lowercase type', body: { type: 'opened' } },
    { label: 'missing type', body: {} },
    { label: 'non-string type', body: { type: 1 } },
  ])('rejects a body with $label', async ({ body }, { env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    const res = await ada.device.post(`/api/posts/${post.id}/views`, body);

    expect(res.statusCode, res.body).toBe(400);
    expect(await env.app.prisma.view.count()).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Comments                                                                  */
/* -------------------------------------------------------------------------- */

describe('POST /api/posts/:postId/comments', () => {
  test('creates a top-level comment owned by the caller and returns it', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    const res = await makeComment(ada.device, post.id, 'First!');

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({
      text: 'First!',
      likeCount: 0,
      replyCount: 0,
      commenter: { id: ada.id, forename: 'Ada', surname: 'Lovelace', avatarKey: null },
    });
    const [row] = await env.app.prisma.comment.findMany();
    expect(row).toMatchObject({ id: res.json().id, postId: post.id, commenterId: ada.id, parentId: null });
  });

  test('the commenter is returned with public fields only', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    const { commenter } = (await makeComment(ada.device, post.id)).json();

    for (const secret of ['email', 'password', 'deletedAt', 'avatarId', 'avatar']) {
      expect(commenter, `"${secret}" must not be exposed`).not.toHaveProperty(secret);
    }
  });

  test('the commenter cannot be spoofed through the body', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    await ada.device.post(`/api/posts/${post.id}/comments`, { text: 'hi', commenterId: grace.id });

    const [row] = await env.app.prisma.comment.findMany();
    expect(row?.commenterId).toBe(ada.id);
  });

  test.for([
    { label: 'empty text', body: { text: '' } },
    { label: 'missing text', body: {} },
    // A number is not tested: Fastify's ajv coerces 42 to "42".
    { label: 'null text', body: { text: null } },
    { label: 'object text', body: { text: {} } },
  ])('rejects a body with $label', async ({ body }, { env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);

    const res = await ada.device.post(`/api/posts/${post.id}/comments`, body);

    expect(res.statusCode, res.body).toBe(400);
    expect(await env.app.prisma.comment.count()).toBe(0);
  });
});

describe('GET /api/posts/:postId/comments', () => {
  test('lists only this post\'s top-level comments, newest first', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const other = await createPost(env, grace);
    const older = await seedComment(env, post.id, ada, { text: 'older', createdAt: daysAgo(2) });
    const newer = await seedComment(env, post.id, ada, { text: 'newer', createdAt: daysAgo(1) });
    await seedComment(env, post.id, grace, { text: 'a reply', parentId: older.id });
    await seedComment(env, other.id, ada, { text: 'elsewhere' });

    const res = await getComments(env.device(), post.id);

    expect(res.statusCode).toBe(200);
    expect(idsOf(res)).toEqual([newer.id, older.id]);
  });

  test('returns an empty list for a post with no comments', async ({ env }) => {
    const { grace } = await people(env);
    const post = await createPost(env, grace);

    expect((await getComments(env.device(), post.id)).json()).toEqual([]);
  });

  test('reports like and reply counts', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada);
    await likeComment(grace.device, post.id, comment.id);
    await likeComment(alan.device, post.id, comment.id);
    await replyTo(grace.device, post.id, comment.id);

    const [entry] = (await getComments(env.device(), post.id)).json();

    expect(entry).toMatchObject({ id: comment.id, likeCount: 2, replyCount: 1 });
  });

  test('paginates with cursor and take, with no gaps or repeats', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comments = [];
    for (let i = 0; i < 5; i++) {
      comments.push(await seedComment(env, post.id, ada, { text: `c${i}`, createdAt: daysAgo(10 - i) }));
    }
    const newestFirst = comments.map((c) => c.id).reverse();
    const anon = env.device();

    const page1 = await getComments(anon, post.id, '?take=2');
    expect(idsOf(page1)).toEqual(newestFirst.slice(0, 2));

    const page2 = await getComments(anon, post.id, `?take=2&cursor=${newestFirst[1]}`);
    expect(idsOf(page2)).toEqual(newestFirst.slice(2, 4));

    const page3 = await getComments(anon, post.id, `?take=2&cursor=${newestFirst[3]}`);
    expect(idsOf(page3)).toEqual(newestFirst.slice(4));

    const page4 = await getComments(anon, post.id, `?take=2&cursor=${newestFirst[4]}`);
    expect(page4.json()).toEqual([]);
  });

  test('defaults to 10 comments per page', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    for (let i = 0; i < 12; i++) await seedComment(env, post.id, ada, { createdAt: daysAgo(20 - i) });

    expect((await getComments(env.device(), post.id)).json()).toHaveLength(10);
  });

  test('rejects a malformed cursor with 400', async ({ env }) => {
    const { grace } = await people(env);
    const post = await createPost(env, grace);

    expect((await getComments(env.device(), post.id, '?cursor=not-a-cuid')).statusCode).toBe(400);
  });

  // A negative take makes Prisma page backwards; an unbounded take is a cheap way to dump a table.
  test.for(['0', '-1', '1.5', 'abc', '100000'])('rejects take=%s with 400', async (take, { env }) => {
    const { grace } = await people(env);
    const post = await createPost(env, grace);

    expect((await getComments(env.device(), post.id, `?take=${take}`)).statusCode).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */
/*  Replies                                                                   */
/* -------------------------------------------------------------------------- */

describe('POST /api/posts/:postId/comments/:commentId/replies', () => {
  test('replies to a top-level comment', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);

    const res = await replyTo(ada.device, post.id, comment.id, 'Agreed');

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ text: 'Agreed', commenter: { id: ada.id } });
    const row = await env.app.prisma.comment.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(row).toMatchObject({ parentId: comment.id, postId: post.id, commenterId: ada.id });
  });

  test('replying to a reply attaches to the top-level comment (threads are one level deep)', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const post = await createPost(env, grace);
    const top = await seedComment(env, post.id, grace);
    const first = await replyTo(ada.device, post.id, top.id, 'first reply');

    const nested = await replyTo(alan.device, post.id, first.json().id, 'reply to a reply');

    expect(nested.statusCode, nested.body).toBe(200);
    const row = await env.app.prisma.comment.findUniqueOrThrow({ where: { id: nested.json().id } });
    expect(row.parentId, 'flattened onto the top-level comment').toBe(top.id);
    expect(idsOf(await getReplies(env.device(), post.id, top.id)).sort()).toEqual(
      [first.json().id, nested.json().id].sort(),
    );
    expect((await getReplies(env.device(), post.id, first.json().id)).json()).toEqual([]);
  });

  test('is rejected with 404 when the comment is soft-deleted', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace, { deletedAt: new Date() });

    const res = await replyTo(ada.device, post.id, comment.id);

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'NotFound' });
    expect(await env.app.prisma.comment.count()).toBe(1);
  });

  test('is rejected with 404 when the comment belongs to a different post', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const otherPost = await createPost(env, grace);
    const comment = await seedComment(env, otherPost.id, grace);

    const res = await replyTo(ada.device, post.id, comment.id);

    expect(res.statusCode).toBe(404);
    expect(await env.app.prisma.comment.count()).toBe(1);
  });

  test('rejects empty text with 400', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);

    expect((await replyTo(ada.device, post.id, comment.id, '')).statusCode).toBe(400);
  });
});

describe('GET /api/posts/:postId/comments/:commentId/replies', () => {
  test('lists only that comment\'s live replies, newest first', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const top = await seedComment(env, post.id, grace);
    const otherTop = await seedComment(env, post.id, grace);
    const older = await seedComment(env, post.id, ada, { parentId: top.id, createdAt: daysAgo(2) });
    const newer = await seedComment(env, post.id, ada, { parentId: top.id, createdAt: daysAgo(1) });
    await seedComment(env, post.id, ada, { parentId: top.id, deletedAt: new Date() });
    await seedComment(env, post.id, ada, { parentId: otherTop.id });

    const res = await getReplies(env.device(), post.id, top.id);

    expect(res.statusCode).toBe(200);
    expect(idsOf(res)).toEqual([newer.id, older.id]);
  });

  test('is empty when the comment belongs to another post', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const otherPost = await createPost(env, grace);
    const top = await seedComment(env, post.id, grace);
    await seedComment(env, post.id, ada, { parentId: top.id });

    expect((await getReplies(env.device(), otherPost.id, top.id)).json()).toEqual([]);
  });

  test('paginates with cursor and take', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const top = await seedComment(env, post.id, grace);
    const replies = [];
    for (let i = 0; i < 3; i++) {
      replies.push(await seedComment(env, post.id, ada, { parentId: top.id, createdAt: daysAgo(5 - i) }));
    }
    const newestFirst = replies.map((r) => r.id).reverse();
    const anon = env.device();

    expect(idsOf(await getReplies(anon, post.id, top.id, '?take=2'))).toEqual(newestFirst.slice(0, 2));
    expect(idsOf(await getReplies(anon, post.id, top.id, `?take=2&cursor=${newestFirst[1]}`))).toEqual(
      newestFirst.slice(2),
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Editing                                                                   */
/* -------------------------------------------------------------------------- */

describe('PATCH /api/posts/:postId/comments/:commentId (edit)', () => {
  test('lets the author change the text', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada, { text: 'before' });

    const res = await editComment(ada.device, post.id, comment.id, 'after');

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ id: comment.id, text: 'after' });
    expect((await env.app.prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).text).toBe('after');
  });

  test('bumps updatedAt and leaves createdAt alone', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada, { createdAt: daysAgo(1) });

    const { createdAt, updatedAt } = (await editComment(ada.device, post.id, comment.id)).json();

    expect(new Date(createdAt).getTime()).toBe(comment.createdAt.getTime());
    expect(new Date(updatedAt).getTime()).toBeGreaterThan(comment.updatedAt.getTime());
  });

  test('works on replies too', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const top = await seedComment(env, post.id, grace);
    const reply = await seedComment(env, post.id, ada, { parentId: top.id });

    const res = await editComment(ada.device, post.id, reply.id, 'edited reply');

    expect(res.statusCode).toBe(200);
    expect(res.json().text).toBe('edited reply');
  });

  test('returns 403 for someone else\'s comment and leaves it untouched', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada, { text: 'mine' });

    const res = await editComment(alan.device, post.id, comment.id, 'hijacked');

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      error: 'Forbidden',
      message: 'You cannot edit a comment you did not author',
    });
    expect((await env.app.prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).text).toBe('mine');
  });

  test('the post author cannot edit other people\'s comments', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada);

    expect((await editComment(grace.device, post.id, comment.id)).statusCode).toBe(403);
  });

  test('rejects empty text with 400', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada, { text: 'keep me' });

    expect((await editComment(ada.device, post.id, comment.id, '')).statusCode).toBe(400);
    expect((await env.app.prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).text).toBe('keep me');
  });

  test('returns 404 when the comment is addressed through the wrong post', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const otherPost = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada, { text: 'original' });

    const res = await editComment(ada.device, otherPost.id, comment.id, 'changed');

    expect(res.statusCode, res.body).toBe(404);
    expect((await env.app.prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).text).toBe('original');
  });

  // Otherwise an edit would silently resurrect text that delete deliberately blanked.
  test('cannot edit a deleted comment', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada);
    await deleteComment(ada.device, post.id, comment.id);

    const res = await editComment(ada.device, post.id, comment.id, 'back from the dead');

    expect(res.statusCode, res.body).toBe(404);
    expect((await env.app.prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).text).not.toBe(
      'back from the dead',
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Deleting                                                                  */
/* -------------------------------------------------------------------------- */

describe('DELETE /api/posts/:postId/comments/:commentId', () => {
  test('soft-deletes the comment, blanks its text, and hides it from the list', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada, { text: 'regrettable' });

    const res = await deleteComment(ada.device, post.id, comment.id);

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    const row = await env.app.prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.text, 'the content must not be retained').not.toBe('regrettable');
    expect((await getComments(env.device(), post.id)).json()).toEqual([]);
  });

  test('a deleted top-level comment with live replies stays listed, without its text', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const top = await seedComment(env, post.id, ada, { text: 'secret words' });
    const reply = await seedComment(env, post.id, grace, { parentId: top.id, text: 'still here' });

    await deleteComment(ada.device, post.id, top.id);

    const list = await getComments(env.device(), post.id);
    expect(idsOf(list)).toEqual([top.id]);
    expect(list.body).not.toContain('secret words');
    expect(idsOf(await getReplies(env.device(), post.id, top.id))).toEqual([reply.id]);
  });

  test('a deleted top-level comment disappears once its last reply is deleted too', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const top = await seedComment(env, post.id, ada);
    const reply = await seedComment(env, post.id, grace, { parentId: top.id });
    await deleteComment(ada.device, post.id, top.id);

    await deleteComment(grace.device, post.id, reply.id);

    expect((await getComments(env.device(), post.id)).json()).toEqual([]);
  });

  test('a deleted reply is hidden from the replies list', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const top = await seedComment(env, post.id, grace);
    const reply = await seedComment(env, post.id, ada, { parentId: top.id });

    expect((await deleteComment(ada.device, post.id, reply.id)).statusCode).toBe(204);

    expect((await getReplies(env.device(), post.id, top.id)).json()).toEqual([]);
  });

  test('returns 403 for someone else\'s comment and leaves it untouched', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada, { text: 'mine' });

    const res = await deleteComment(alan.device, post.id, comment.id);

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      error: 'Forbidden',
      message: 'You cannot delete a comment you did not author',
    });
    const row = await env.app.prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
    expect(row).toMatchObject({ text: 'mine', deletedAt: null });
  });

  test('returns 404 when the comment is addressed through the wrong post', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const otherPost = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada);

    const res = await deleteComment(ada.device, otherPost.id, comment.id);

    expect(res.statusCode, res.body).toBe(404);
    expect((await env.app.prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).deletedAt).toBeNull();
  });

  test('deleting twice does not fail', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, ada);

    expect((await deleteComment(ada.device, post.id, comment.id)).statusCode).toBe(204);
    expect((await deleteComment(ada.device, post.id, comment.id)).statusCode).toBe(204);
  });
});

/* -------------------------------------------------------------------------- */
/*  Comment likes                                                             */
/* -------------------------------------------------------------------------- */

describe('PUT/DELETE /api/posts/:postId/comments/:commentId/likes', () => {
  test('like adds one like owned by the caller, reflected in likeCount', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);

    const res = await likeComment(ada.device, post.id, comment.id);

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    const rows = await env.app.prisma.commentLike.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: ada.id, commentId: comment.id });
    expect((await getComments(env.device(), post.id)).json()[0].likeCount).toBe(1);
  });

  test('parallel duplicate likes all succeed and store one like', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => likeComment(ada.device, post.id, comment.id)),
    );

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(204));
    expect(await env.app.prisma.commentLike.count()).toBe(1);
  });

  test('unlike removes only the caller\'s like on that comment', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const post = await createPost(env, grace);
    const a = await seedComment(env, post.id, grace);
    const b = await seedComment(env, post.id, grace);
    await likeComment(ada.device, post.id, a.id);
    await likeComment(alan.device, post.id, a.id);
    await likeComment(ada.device, post.id, b.id);

    const res = await unlikeComment(ada.device, post.id, a.id);

    expect(res.statusCode).toBe(204);
    const rows = await env.app.prisma.commentLike.findMany();
    expect(rows.map((r) => `${r.userId}>${r.commentId}`).sort()).toEqual(
      [`${alan.id}>${a.id}`, `${ada.id}>${b.id}`].sort(),
    );
  });

  test('unliking a comment you never liked succeeds', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);

    expect((await unlikeComment(ada.device, post.id, comment.id)).statusCode).toBe(204);
  });

  test('parallel duplicate unlikes all succeed', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const comment = await seedComment(env, post.id, grace);
    await likeComment(ada.device, post.id, comment.id);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => unlikeComment(ada.device, post.id, comment.id)),
    );

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(204));
    expect(await env.app.prisma.commentLike.count()).toBe(0);
  });

  test('works on replies', async ({ env }) => {
    const { ada, grace } = await people(env);
    const post = await createPost(env, grace);
    const top = await seedComment(env, post.id, grace);
    const reply = await seedComment(env, post.id, grace, { parentId: top.id });

    await likeComment(ada.device, post.id, reply.id);

    expect((await getReplies(env.device(), post.id, top.id)).json()[0].likeCount).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Feed                                                                      */
/* -------------------------------------------------------------------------- */

describe('GET /api/posts (anonymous: latest)', () => {
  test('lists published posts from everyone, newest first', async ({ env }) => {
    const { grace, alan } = await people(env);
    const oldest = await createPost(env, grace, { publishedAt: daysAgo(3) });
    const newest = await createPost(env, alan, { publishedAt: daysAgo(1) });
    const middle = await createPost(env, grace, { publishedAt: daysAgo(2) });

    const res = await getFeed(env.device());

    expect(res.statusCode, res.body).toBe(200);
    expect(idsOf(res)).toEqual([newest.id, middle.id, oldest.id]);
  });

  test('omits drafts, deleted posts and posts by deleted authors', async ({ env }) => {
    const { grace, alan } = await people(env);
    const visible = await createPost(env, grace);
    await createPost(env, grace, { publishedAt: null });
    await createPost(env, grace, { deletedAt: new Date() });
    await createPost(env, alan);
    await deleteAccount(alan.device);

    expect(idsOf(await getFeed(env.device()))).toEqual([visible.id]);
  });

  test('returns the feed card shape with public author fields only', async ({ env }) => {
    const { grace } = await people(env);
    const tagA = await createTag(env, 'typescript');
    const tagB = await createTag(env, 'testing');
    const post = await createPost(env, grace, { tags: [tagA, tagB], readingTime: 5, title: 'Card' });

    const [card] = (await getFeed(env.device())).json();

    expect(card).toMatchObject({
      id: post.id,
      title: 'Card',
      readingTime: 5,
      coverKey: expect.stringContaining(post.id),
      author: { id: grace.id, forename: 'Grace', surname: 'Hopper', avatarKey: null },
    });
    expect([...card.tags].sort()).toEqual(['testing', 'typescript']);
    expect(card).not.toHaveProperty('publishedHtml');
    for (const secret of ['email', 'password', 'deletedAt', 'avatarId', 'avatar']) {
      expect(card.author, `"${secret}" must not be exposed`).not.toHaveProperty(secret);
    }
  });

  test('is empty when nothing is published', async ({ env }) => {
    expect((await getFeed(env.device())).json()).toEqual([]);
  });
});

describe('GET /api/posts (signed in: personalised)', () => {
  test('is empty for a user with no interests and no follows', async ({ env }) => {
    const { ada, grace } = await people(env);
    const tag = await createTag(env, 'rust');
    await createPost(env, grace, { tags: [tag] });

    const res = await getFeed(ada.device);

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('includes posts matching an onboarding interest', async ({ env }) => {
    const { ada, grace } = await people(env);
    const rust = await createTag(env, 'rust');
    const go = await createTag(env, 'go');
    await addOnboardingInterest(env, ada, rust);
    const match = await createPost(env, grace, { tags: [rust] });
    await createPost(env, grace, { tags: [go] });

    expect(idsOf(await getFeed(ada.device))).toEqual([match.id]);
  });

  test('includes posts from followed authors even without a tag match', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    const followed = await createPost(env, grace);
    await createPost(env, alan);

    expect(idsOf(await getFeed(ada.device))).toEqual([followed.id]);
  });

  test('never includes the user\'s own posts', async ({ env }) => {
    const { ada, grace } = await people(env);
    const tag = await createTag(env, 'rust');
    await addOnboardingInterest(env, ada, tag);
    await createPost(env, ada, { tags: [tag] });
    const other = await createPost(env, grace, { tags: [tag] });

    expect(idsOf(await getFeed(ada.device))).toEqual([other.id]);
  });

  test('omits drafts, deleted posts and posts by deleted authors', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const tag = await createTag(env, 'rust');
    await addOnboardingInterest(env, ada, tag);
    const visible = await createPost(env, grace, { tags: [tag] });
    await createPost(env, grace, { tags: [tag], publishedAt: null });
    await createPost(env, grace, { tags: [tag], deletedAt: new Date() });
    await createPost(env, alan, { tags: [tag] });
    await deleteAccount(alan.device);

    expect(idsOf(await getFeed(ada.device))).toEqual([visible.id]);
  });

  test.for(['OPENED', 'READ'] as const)('omits posts the user has already viewed (%s)', async (type, { env }) => {
    const { ada, grace } = await people(env);
    const tag = await createTag(env, 'rust');
    await addOnboardingInterest(env, ada, tag);
    const seen = await createPost(env, grace, { tags: [tag] });
    const unseen = await createPost(env, grace, { tags: [tag] });
    await viewPost(ada.device, seen.id, type);

    expect(idsOf(await getFeed(ada.device))).toEqual([unseen.id]);
  });

  test('another user\'s views do not hide posts from me', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    const tag = await createTag(env, 'rust');
    await addOnboardingInterest(env, ada, tag);
    const post = await createPost(env, grace, { tags: [tag] });
    await viewPost(alan.device, post.id, 'READ');

    expect(idsOf(await getFeed(ada.device))).toEqual([post.id]);
  });

  test('is capped at 100 posts', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);
    for (let i = 0; i < 105; i++) await createPost(env, grace, { publishedAt: daysAgo(i / 100) });

    expect((await getFeed(ada.device)).json()).toHaveLength(100);
  });

  describe('ranking', () => {
    test('a followed author outranks a plain tag match (follow bonus beats a fresh onboarding interest)', async ({ env }) => {
      const { ada, grace, alan } = await people(env);
      const tag = await createTag(env, 'rust');
      await addOnboardingInterest(env, ada, tag);
      await follow(ada.device, grace.id);
      const tagged = await createPost(env, alan, { tags: [tag] });
      const followed = await createPost(env, grace);

      expect(idsOf(await getFeed(ada.device))).toEqual([followed.id, tagged.id]);
    });

    test('a post focused on the user\'s interest outranks one that merely has many tags', async ({ env }) => {
      const { ada, grace } = await people(env);
      const [a, b, c, d] = await Promise.all(['a', 'b', 'c', 'd'].map((n) => createTag(env, n)));
      await addOnboardingInterest(env, ada, a!);
      const focused = await createPost(env, grace, { tags: [a!] });
      const diluted = await createPost(env, grace, { tags: [a!, b!, c!, d!] });

      expect(idsOf(await getFeed(ada.device))).toEqual([focused.id, diluted.id]);
    });

    test('posts matching more of the user\'s interests rank higher', async ({ env }) => {
      const { ada, grace } = await people(env);
      const x = await createTag(env, 'x');
      const y = await createTag(env, 'y');
      await addOnboardingInterest(env, ada, x);
      await addOnboardingInterest(env, ada, y);
      const one = await createPost(env, grace, { tags: [x] });
      const both = await createPost(env, grace, { tags: [x, y] });

      expect(idsOf(await getFeed(ada.device))).toEqual([both.id, one.id]);
    });

    test('with equal matches, the fresher post ranks higher regardless of insertion order', async ({ env }) => {
      const { ada, grace } = await people(env);
      const tag = await createTag(env, 'rust');
      await addOnboardingInterest(env, ada, tag);
      const stale = await createPost(env, grace, { tags: [tag], publishedAt: daysAgo(28) });
      const fresh = await createPost(env, grace, { tags: [tag], publishedAt: new Date() });

      expect(idsOf(await getFeed(ada.device))).toEqual([fresh.id, stale.id]);
    });

    test('a stale onboarding interest weighs less than a recent one', async ({ env }) => {
      const { ada, grace } = await people(env);
      const old = await createTag(env, 'old-interest');
      const recent = await createTag(env, 'recent-interest');
      await addOnboardingInterest(env, ada, old, daysAgo(90));
      await addOnboardingInterest(env, ada, recent);
      const oldPost = await createPost(env, grace, { tags: [old] });
      const recentPost = await createPost(env, grace, { tags: [recent] });

      expect(idsOf(await getFeed(ada.device))).toEqual([recentPost.id, oldPost.id]);
    });
  });

  describe('learned interests', () => {
    test('reading a post makes its tags an interest', async ({ env }) => {
      const { ada, grace } = await people(env);
      const tag = await createTag(env, 'databases');
      const read = await createPost(env, grace, { tags: [tag] });
      const next = await createPost(env, grace, { tags: [tag] });
      await viewPost(ada.device, read.id, 'READ');

      expect(idsOf(await getFeed(ada.device))).toEqual([next.id]);
    });

    test('merely opening a post does not', async ({ env }) => {
      const { ada, grace } = await people(env);
      const tag = await createTag(env, 'databases');
      const opened = await createPost(env, grace, { tags: [tag] });
      await createPost(env, grace, { tags: [tag] });
      await viewPost(ada.device, opened.id, 'OPENED');

      expect((await getFeed(ada.device)).json()).toEqual([]);
    });

    test('a READ older than the 60-day window no longer counts', async ({ env }) => {
      const { ada, grace } = await people(env);
      const tag = await createTag(env, 'databases');
      const read = await createPost(env, grace, { tags: [tag] });
      await createPost(env, grace, { tags: [tag] });
      await env.app.prisma.view.create({
        data: { userId: ada.id, postId: read.id, type: 'READ', createdAt: daysAgo(61) },
      });

      expect((await getFeed(ada.device)).json()).toEqual([]);
    });

    test('liking a post makes its tags an interest', async ({ env }) => {
      const { ada, grace } = await people(env);
      const tag = await createTag(env, 'databases');
      const liked = await createPost(env, grace, { tags: [tag] });
      const next = await createPost(env, grace, { tags: [tag] });
      await likePost(ada.device, liked.id);

      // Unlike a viewed post, a liked one is not excluded; only its tags become an interest.
      expect(idsOf(await getFeed(ada.device)).sort()).toEqual([liked.id, next.id].sort());
    });

    // The engaged-posts query filters views by userId but not likes, so anyone's like counts as mine.
    test('other users\' likes do not shape my interests', async ({ env }) => {
      const { ada, grace, alan } = await people(env);
      const tag = await createTag(env, 'databases');
      const liked = await createPost(env, grace, { tags: [tag] });
      await createPost(env, grace, { tags: [tag] });
      await likePost(alan.device, liked.id);

      expect((await getFeed(ada.device)).json()).toEqual([]);
    });
  });
});
