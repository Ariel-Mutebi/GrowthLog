import { describe, expect } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import { STRONG_PASSWORD, deleteAccount, signedInDevice } from './helpers/user.js';

const LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Suggestion {
  id: string;
  name: string;
  postCount: number;
}

const search = (env: TestEnv, term: string) =>
  env.device().get(`/api/tags?search=${encodeURIComponent(term)}`);
const searchRaw = (env: TestEnv, rawQuery: string) => env.device().get(`/api/tags?${rawQuery}`);
const names = (res: LightMyRequestResponse) => (res.json() as Suggestion[]).map((t) => t.name);

async function seedTags(env: TestEnv, tagNames: string[]) {
  const ids: Record<string, string> = {};
  for (const name of tagNames) {
    ids[name] = (await env.app.prisma.tag.create({ data: { name } })).id;
  }
  return ids;
}

let counter = 0;

async function createAuthor(env: TestEnv) {
  const n = ++counter;
  const email = `author${n}@example.com`;
  const { device, id } = await signedInDevice(env, { email, username: `author-${n}` });
  return { device, id, email };
}

/** Writes a post straight to the DB, skipping the draft -> publish lifecycle. */
async function seedPost(
  env: TestEnv,
  authorId: string,
  opts: { tagIds: string[]; published?: boolean; deleted?: boolean },
) {
  const n = ++counter;
  const published = opts.published !== false;
  return env.app.prisma.post.create({
    data: {
      authorId,
      title: `Post ${n}`,
      slug: `post-${n}`,
      draftContent: Buffer.from('draft'),
      ...(published && {
        publishedTitle: `Post ${n}`,
        publishedHook: 'Hook',
        publishedHtml: '<p>Body</p>',
        publishedAt: new Date(),
        readingTime: 1,
      }),
      deletedAt: opts.deleted ? new Date() : null,
      tags: { connect: opts.tagIds.map((id) => ({ id })) },
    },
  });
}

/** Tags that are publicly visible: one published post each, from a live author. */
async function seedLiveTags(env: TestEnv, tagNames: string[], authorId?: string) {
  const author = authorId ?? (await createAuthor(env)).id;
  const ids = await seedTags(env, tagNames);
  for (const name of tagNames) await seedPost(env, author, { tagIds: [ids[name]!] });
  return ids;
}

const softDeleteUser = (env: TestEnv, id: string, daysAgo = 0) =>
  env.app.prisma.user.update({ where: { id }, data: { deletedAt: new Date(Date.now() - daysAgo * DAY_MS) } });

const counts = async (env: TestEnv) => ({
  tags: await env.app.prisma.tag.count(),
  posts: await env.app.prisma.post.count(),
  users: await env.app.prisma.user.count(),
});

describe('search', () => {
  test('returns matching tags (substring, case as stored) with exactly id, name and postCount', async ({ env }) => {
    const ids = await seedLiveTags(env, ['javascript', 'python']);

    for (const term of ['javascript', 'java', 'script', 'vascri']) {
      const res = await search(env, term);
      expect(res.statusCode, term).toBe(200);
      expect(res.json(), term).toEqual([{ id: ids['javascript'], name: 'javascript', postCount: 1 }]);
    }
    expect((await search(env, 'zzzz')).json()).toEqual([]);
  });

  test('is public and does not set cookies', async ({ env }) => {
    await seedLiveTags(env, ['javascript']);
    const device = env.device();

    const res = await device.get('/api/tags?search=java');

    expect(res.statusCode).toBe(200);
    expect(res.cookies).toHaveLength(0);
  });

  test('ranks exact, then prefix, then substring, then shorter, then alphabetical', async ({ env }) => {
    await seedLiveTags(env, ['createreactapp', 'reactnative', 'vue', 'preact', 'reactive', 'react', 'rb', 'ra']);

    expect(names(await search(env, 'react'))).toEqual([
      'react',
      'reactive',
      'reactnative',
      'preact',
      'createreactapp',
    ]);
    expect(names(await search(env, 'r')).slice(0, 2), 'equal length falls back to alphabetical').toEqual(['ra', 'rb']);
  });

  test('returns at most 10, the best-ranked 10, filtered before the limit', async ({ env }) => {
    const authorId = (await createAuthor(env)).id;
    const visible = Array.from({ length: 15 }, (_, i) => `node${String(i + 1).padStart(2, '0')}`);
    await seedLiveTags(env, [...visible].reverse(), authorId);

    // Ten higher-ranked (shorter) tags that are hidden must not eat the slots.
    const hidden = Array.from({ length: LIMIT }, (_, i) => `no${i}`);
    const hiddenIds = await seedTags(env, hidden);
    for (const name of hidden) await seedPost(env, authorId, { tagIds: [hiddenIds[name]!], published: false });

    const res = await search(env, 'no');

    expect(res.json()).toHaveLength(LIMIT);
    expect(names(res)).toEqual(visible.slice(0, LIMIT));
  });
});

describe('postCount', () => {
  test('counts only published, non-deleted posts', async ({ env }) => {
    const { id: authorId } = await createAuthor(env);
    const ids = await seedTags(env, ['rust']);
    const tagIds = [ids['rust']!];
    await seedPost(env, authorId, { tagIds });
    await seedPost(env, authorId, { tagIds });
    await seedPost(env, authorId, { tagIds, published: false });
    await seedPost(env, authorId, { tagIds, deleted: true });

    expect((await search(env, 'rust')).json()).toEqual([{ id: ids['rust'], name: 'rust', postCount: 2 }]);
  });

  test('is not inflated by posts that carry several tags', async ({ env }) => {
    const { id: authorId } = await createAuthor(env);
    const ids = await seedTags(env, ['go', 'golang', 'gopher']);
    const all = Object.values(ids);
    await seedPost(env, authorId, { tagIds: all });
    await seedPost(env, authorId, { tagIds: all });
    await seedPost(env, authorId, { tagIds: [ids['go']!] });

    const byName = Object.fromEntries(
      ((await search(env, 'go')).json() as Suggestion[]).map((t) => [t.name, t.postCount]),
    );
    expect(byName).toEqual({ go: 3, golang: 2, gopher: 2 });
  });
});

describe('visibility', () => {
  test('tags with no visible post are hidden, and a hidden tag looks exactly like a nonexistent one', async ({ env }) => {
    const { id: authorId } = await createAuthor(env);
    const ids = await seedTags(env, ['draftonly', 'deletedonly', 'noposts', 'both']);
    await seedPost(env, authorId, { tagIds: [ids['draftonly']!], published: false });
    await seedPost(env, authorId, { tagIds: [ids['deletedonly']!], deleted: true });
    await seedPost(env, authorId, { tagIds: [ids['both']!], published: false });
    await seedPost(env, authorId, { tagIds: [ids['both']!] });

    for (const term of ['draftonly', 'draft', 'deletedonly', 'noposts']) {
      expect((await search(env, term)).json(), term).toEqual([]);
    }
    const hidden = await search(env, 'draftonly');
    const absent = await search(env, 'neverexisted');
    expect(hidden.body, 'no existence oracle').toBe(absent.body);

    expect((await search(env, 'both')).json(), 'a tag with one visible post stays, counting only that post').toEqual([
      { id: ids['both'], name: 'both', postCount: 1 },
    ]);
  });

  test('tracks a post going draft -> published -> deleted, with no stale results', async ({ env }) => {
    const { id: authorId } = await createAuthor(env);
    const ids = await seedTags(env, ['live']);
    const post = await seedPost(env, authorId, { tagIds: [ids['live']!], published: false });
    expect((await search(env, 'live')).json()).toEqual([]);

    await env.app.prisma.post.update({ where: { id: post.id }, data: { publishedAt: new Date() } });
    expect(names(await search(env, 'live'))).toEqual(['live']);

    await env.app.prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });
    expect((await search(env, 'live')).json()).toEqual([]);
  });

  test('a soft-deleted author is hidden everywhere, including from counts of still-visible tags', async ({ env }) => {
    const live = (await createAuthor(env)).id;
    const gone = (await createAuthor(env)).id;
    const ids = await seedTags(env, ['solo', 'shared']);
    await seedPost(env, gone, { tagIds: [ids['solo']!] });
    await seedPost(env, live, { tagIds: [ids['shared']!] });
    await seedPost(env, gone, { tagIds: [ids['shared']!] });
    await softDeleteUser(env, gone);

    expect((await search(env, 'solo')).json()).toEqual([]);
    expect((await search(env, 'shared')).json()).toEqual([{ id: ids['shared'], name: 'shared', postCount: 1 }]);
  });

  test('account deletion hides tags; re-login in the window restores them; an expired deletion stays hidden', async ({
    env,
  }) => {
    const { device, id, email } = await createAuthor(env);
    const ids = await seedTags(env, ['recoverable']);
    await seedPost(env, id, { tagIds: [ids['recoverable']!] });

    await deleteAccount(device);
    expect((await search(env, 'recoverable')).json(), 'hidden after deletion').toEqual([]);

    const restored = env.device();
    const relogin = await restored.post('/api/sessions', { email, password: STRONG_PASSWORD });
    expect(relogin.statusCode).toBe(200);
    expect(names(await search(env, 'recoverable')), 'visible after restore').toEqual(['recoverable']);

    await deleteAccount(restored);
    await softDeleteUser(env, id, 8);
    expect((await search(env, 'recoverable')).json(), 'hidden after the window expires').toEqual([]);
  });

  test('hard-deleting the author (cascade) hides the tag but keeps the tag row', async ({ env }) => {
    const { id } = await createAuthor(env);
    const ids = await seedTags(env, ['cascaded']);
    await seedPost(env, id, { tagIds: [ids['cascaded']!] });

    await env.app.prisma.user.delete({ where: { id } });

    expect((await search(env, 'cascaded')).json()).toEqual([]);
    expect(await env.app.prisma.tag.findUnique({ where: { id: ids['cascaded']! } })).not.toBeNull();
  });
});

describe('input validation and injection', () => {
  test('accepts 1 and 25 characters, rejects 26 and far longer', async ({ env }) => {
    const longest = 'a'.repeat(25);
    await seedLiveTags(env, ['a', longest]);

    expect((await search(env, 'a')).statusCode).toBe(200);
    expect(names(await search(env, longest))).toEqual([longest]);
    expect((await search(env, 'a'.repeat(26))).statusCode).toBe(400);
    expect((await search(env, 'a'.repeat(20_000))).statusCode).toBe(400);
  });

  test('rejects anything outside [a-z0-9]+ with a clean 400 and no database effect', async ({ env }) => {
    await seedLiveTags(env, ['javascript', 'python', 'ab', 'axb']);
    const before = await counts(env);

    const encoded = [
      '', ' ', 'JAVA', 'ja va', 'java\n', 'c++', 'machine-learning', 'café', '😀', 'ｊａｖａ',
      // LIKE wildcards: must never behave as match-all
      '%', '_', 'a%b', 'a_b', '\\',
      // SQL injection
      '\'; DROP TABLE "Tag"; --',
      '\' OR \'1\'=\'1',
      '\' UNION SELECT id, email, 0 FROM "User" --',
      '\'; SELECT pg_sleep(5); --',
    ];
    for (const term of encoded) {
      const started = Date.now();
      const res = await search(env, term);
      expect(res.statusCode, JSON.stringify(term)).toBe(400);
      expect(Date.now() - started, `${JSON.stringify(term)} must not be executed`).toBeLessThan(3_000);
      expect(res.body).not.toMatch(/prisma|postgres|SELECT|@example\.com|\bat .*:\d+:\d+/i);
    }

    // Raw forms the client-side encoder can't produce.
    for (const raw of ['search', 'search=a%00b', 'search=%', 'search=%E0%A4%A', 'search=%ED%A0%80ab', 'search=%256Aava']) {
      expect((await searchRaw(env, raw)).statusCode, raw).toBe(400);
    }
    // Missing, polluted, array-style or misnamed parameter.
    for (const qs of ['', 'q=java', 'Search=java', 'search=java&search=python', 'search[]=java', 'search[a]=java']) {
      expect((await searchRaw(env, qs)).statusCode, qs).toBe(400);
    }

    expect(await counts(env), 'nothing was altered').toEqual(before);
  });

  test('alphanumeric strings that merely look like SQL are searched as plain text', async ({ env }) => {
    await seedLiveTags(env, ['selectfrom', 'dropdown']);

    expect(names(await search(env, 'select'))).toEqual(['selectfrom']);
    expect((await search(env, 'droptabletag')).json()).toEqual([]);
    expect((await search(env, 'or11')).json()).toEqual([]);
  });

  test('stored hostile tag names are returned as inert data and cannot alter later queries', async ({ env }) => {
    await seedLiveTags(env, ['x\'); DROP TABLE "Tag"; --', 'xfine']);
    const before = await counts(env);

    const res = await search(env, 'x');

    expect(res.statusCode).toBe(200);
    expect(names(res)).toEqual(expect.arrayContaining(['x\'); DROP TABLE "Tag"; --', 'xfine']));
    expect(await counts(env)).toEqual(before);
  });
});
