import { describe, expect } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import { GRACE, signedInDevice } from './helpers/user.js';
import { docToDraftBytes, seedDraft } from './helpers/draft.js';

interface Draft {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

const NOT_FOUND = { error: 'NotFound', message: 'This draft could not be found' };
const METADATA_FIELDS = ['id', 'title', 'slug', 'createdAt', 'updatedAt', 'publishedAt'];

const draftsOf = (res: LightMyRequestResponse) => res.json() as Draft[];
const idsOf = (res: LightMyRequestResponse) => draftsOf(res).map((d) => d.id);
const row = (env: TestEnv, id: string) => env.app.prisma.post.findUniqueOrThrow({ where: { id } });

/** Only authoring metadata may reach the client: never content, author, deletion state or published fields. */
function expectMetadataOnly(draft: Record<string, unknown>) {
  for (const key of ['id', 'title', 'slug', 'createdAt', 'updatedAt']) expect(draft, key).toHaveProperty(key);
  expect(Object.keys(draft).filter((k) => !METADATA_FIELDS.includes(k)), 'unexpected fields exposed').toEqual([]);
  for (const key of ['createdAt', 'updatedAt']) expect(Number.isNaN(Date.parse(draft[key] as string)), key).toBe(false);
  if (draft['publishedAt'] != null) expect(Number.isNaN(Date.parse(draft['publishedAt'] as string))).toBe(false);
}

async function twoUsers(env: TestEnv) {
  const a = await signedInDevice(env);
  const b = await signedInDevice(env, GRACE);
  return { a, b };
}

describe('POST /api/me/drafts', () => {
  test('creates an untitled draft owned by the caller, exposing metadata only', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await device.post('/api/me/drafts');

    expect(res.statusCode).toBe(201);
    const body = res.json() as Draft;
    expectMetadataOnly(body as object as Record<string, string>);
    expect(body.title).toBe('Untitled');
    expect(body.slug).toMatch(/^untitled-\d{4}$/);
    expect(body.publishedAt ?? null).toBeNull();

    const saved = await row(env, body.id);
    expect(saved.authorId).toBe(id);
    expect(saved.deletedAt).toBeNull();
    expect(saved.draftContent, 'a new draft starts with no content').toBeNull();
    expect(saved.publishedAt).toBeNull();
  });

  test('ignores any attempt to set fields through the body', async ({ env }) => {
    const { a, b } = await twoUsers(env);

    const res = await a.device.post('/api/me/drafts', {
      title: 'Chosen',
      slug: 'chosen',
      authorId: b.id,
      publishedAt: new Date().toISOString(),
      deletedAt: new Date().toISOString(),
    });

    expect(res.statusCode).toBe(201);
    const saved = await row(env, (res.json() as Draft).id);
    expect(saved.authorId, 'must belong to the caller, not the id in the body').toBe(a.id);
    expect(saved.title).toBe('Untitled');
    expect(saved.slug).toMatch(/^untitled-\d{4}$/);
    expect(saved.publishedAt).toBeNull();
    expect(saved.deletedAt).toBeNull();
  });

  test('each call creates a distinct draft that only its author can list', async ({ env }) => {
    const { a, b } = await twoUsers(env);

    const first = (await a.device.post('/api/me/drafts')).json() as Draft;
    const second = (await a.device.post('/api/me/drafts')).json() as Draft;

    expect(first.id).not.toBe(second.id);
    expect(idsOf(await a.device.get('/api/me/drafts')).sort()).toEqual([first.id, second.id].sort());
    expect((await b.device.get('/api/me/drafts')).json()).toEqual([]);
  });

  test('still succeeds when the random slug space is crowded', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    // currently, there is a maximum of 9000 unique 'untitled' slugs,
    // so filling up every single one is guaranteed to test the retry logic.
    await env.app.prisma.post.createMany({
      data: Array.from({ length: 8999 }, (_, i) => ({
        authorId: id,
        title: 'Untitled',
        slug: `untitled-${1000 + i}`,
      })),
    });

    const res = await device.post('/api/me/drafts');

    expect(res.statusCode, `slug collision should be handled, got: ${res.body}`).toBe(201);
  });
});

describe('GET /api/me/drafts', () => {
  test('returns an empty list when the user has no drafts', async ({ env }) => {
    const { device } = await signedInDevice(env);
    const res = await device.get('/api/me/drafts');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('returns only the caller\'s non-deleted posts (drafts and published), as metadata only', async ({ env }) => {
    const { a, b } = await twoUsers(env);
    const draft = await seedDraft(env, a.id);
    const published = await seedDraft(env, a.id, { published: true });
    await seedDraft(env, a.id, { deleted: true });
    const theirs = await seedDraft(env, b.id);

    const res = await a.device.get('/api/me/drafts');

    expect(res.statusCode).toBe(200);
    expect(idsOf(res).sort()).toEqual([draft.id, published.id].sort());
    for (const d of draftsOf(res)) expectMetadataOnly(d as unknown as Record<string, unknown>);
    expect(idsOf(await b.device.get('/api/me/drafts'))).toEqual([theirs.id]);
  });

  test('cannot be widened to other users or deleted drafts with extra parameters', async ({ env }) => {
    const { a, b } = await twoUsers(env);
    const mine = await seedDraft(env, a.id);
    await seedDraft(env, b.id);
    await seedDraft(env, a.id, { deleted: true });

    for (const qs of [`authorId=${b.id}`, `userId=${b.id}`, 'deleted=true', 'includeDeleted=true', 'all=true']) {
      const res = await a.device.get(`/api/me/drafts?${qs}`);
      expect(res.statusCode, qs).toBe(400);
      expect(idsOf(res), qs).toEqual([mine.id]);
    }
  });

  test('filters by published state', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const draft = await seedDraft(env, id);
    const published = await seedDraft(env, id, { published: true });

    expect(idsOf(await device.get('/api/me/drafts?published=true'))).toEqual([published.id]);
    expect(idsOf(await device.get('/api/me/drafts?published=false'))).toEqual([draft.id]);
    expect(idsOf(await device.get('/api/me/drafts')).sort()).toEqual([draft.id, published.id].sort());
  });

  test('sorts by updatedAt (default, ascending) or title, in either direction', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const day = (d: number) => new Date(Date.UTC(2024, 0, d));
    const bravo = await seedDraft(env, id, { title: 'bravo', updatedAt: day(1) });
    const alpha = await seedDraft(env, id, { title: 'alpha', updatedAt: day(3) });
    const charlie = await seedDraft(env, id, { title: 'charlie', updatedAt: day(2) });
    const ids = async (qs: string) => idsOf(await device.get(`/api/me/drafts${qs}`));

    expect(await ids(''), 'default: updatedAt asc').toEqual([bravo.id, charlie.id, alpha.id]);
    expect(await ids('?order=desc')).toEqual([alpha.id, charlie.id, bravo.id]);
    expect(await ids('?sortBy=updatedAt&order=asc')).toEqual([bravo.id, charlie.id, alpha.id]);
    expect(await ids('?sortBy=title')).toEqual([alpha.id, bravo.id, charlie.id]);
    expect(await ids('?sortBy=title&order=desc')).toEqual([charlie.id, bravo.id, alpha.id]);
  });

  test('breaks ties deterministically by id descending', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const same = new Date(Date.UTC(2024, 0, 1));
    const seeded = [];
    for (let i = 0; i < 4; i++) seeded.push(await seedDraft(env, id, { title: 'same', updatedAt: same }));
    const expected = seeded.map((d) => d.id).sort().reverse();

    expect(idsOf(await device.get('/api/me/drafts?sortBy=title&order=asc'))).toEqual(expected);
    expect(idsOf(await device.get('/api/me/drafts?sortBy=updatedAt&order=desc'))).toEqual(expected);
  });

  test('rejects invalid sort, order and filter values with 400', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    await seedDraft(env, id);

    const bad = [
      'sortBy=slug', 'sortBy=createdAt', 'sortBy=id', 'sortBy=', 'sortBy=title;DROP', 'sortBy=__proto__',
      'sortBy[]=title', 'sortBy=title&sortBy=updatedAt',
      'order=ASC', 'order=up', 'order=', 'order=asc&order=desc',
      'published=yes', 'published=2', 'published=true&published=false',
    ];
    for (const qs of bad) {
      const res = await device.get(`/api/me/drafts?${qs}`);
      expect(res.statusCode, qs).toBe(400);
    }
  });
});

describe('GET /api/me/drafts/:id', () => {
  test('returns the draft as metadata only', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const draft = await seedDraft(env, id, { title: 'mine' });

    const res = await device.get(`/api/me/drafts/${draft.id}`);

    expect(res.statusCode).toBe(200);
    expectMetadataOnly(res.json());
    expect(res.json()).toMatchObject({ id: draft.id, title: 'mine', slug: draft.slug });
  });

  test('returns a published post too, with its publishedAt', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const post = await seedDraft(env, id, { published: true });

    const res = await device.get(`/api/me/drafts/${post.id}`);

    expect(res.statusCode).toBe(200);
    expect(Date.parse((res.json() as Draft).publishedAt!)).not.toBeNaN();
  });

  test('a missing, someone else\'s or deleted draft gives the same 404', async ({ env }) => {
    const { a, b } = await twoUsers(env);
    const theirs = await seedDraft(env, b.id);
    const deleted = await seedDraft(env, a.id, { deleted: true });

    const responses = await Promise.all(
      [theirs.id, deleted.id, 'cdoesnotexist000000000000'].map((id) => a.device.get(`/api/me/drafts/${id}`)),
    );

    for (const res of responses) {
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual(NOT_FOUND);
    }
  });
});

describe('PATCH /api/me/drafts/:id', () => {
  test('updates only the title and bumps updatedAt', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const old = new Date(Date.UTC(2020, 0, 1));
    const draft = await seedDraft(env, id, { updatedAt: old });

    const res = await device.patch(`/api/me/drafts/${draft.id}`, { title: 'New title' });

    expect(res.statusCode).toBe(200);
    expectMetadataOnly(res.json());
    expect(res.json()).toMatchObject({ id: draft.id, title: 'New title', slug: draft.slug });
    const saved = await row(env, draft.id);
    expect(saved.title).toBe('New title');
    expect(saved.updatedAt.getTime()).toBeGreaterThan(old.getTime());
    expect(res.json().updatedAt).toBe(saved.updatedAt.toISOString());
  });

  test('never touches the content or the live published version', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const content = docToDraftBytes();
    const post = await seedDraft(env, id, { title: 'Live title', published: true, content });
    const before = await row(env, post.id);

    const res = await device.patch(`/api/me/drafts/${post.id}`, { title: 'Working title' });

    expect(res.statusCode).toBe(200);
    const after = await row(env, post.id);
    expect(Buffer.compare(after.draftContent!, content), 'draft content untouched').toBe(0);
    expect(after.publishedTitle, 'readers keep seeing the published title').toBe('Live title');
    expect(after.publishedHtml).toBe(before.publishedHtml);
    expect(after.publishedAt).toEqual(before.publishedAt);
    expect(after.slug).toBe(before.slug);
  });

  test('rejects missing, empty, over-long and wrongly typed titles with 400 and changes nothing', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const draft = await seedDraft(env, id, { title: 'keep me' });
    const url = `/api/me/drafts/${draft.id}`;

    const bodies: (Record<string, unknown> | undefined)[] = [
      undefined,
      {},
      { title: '' },
      { title: '  ' },
      { title: 'a'.repeat(21) },
      { title: 'a'.repeat(10_000) },
      { title: null },
      { title: {} },
      { title: ['a', 'b'] },
      { name: 'wrong field' },
    ];
    for (const body of bodies) {
      const res = await device.patch(url, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect((await row(env, draft.id)).title).toBe('keep me');
  });

  test('ignores attempts to change any other field (mass assignment)', async ({ env }) => {
    const { a, b } = await twoUsers(env);
    const draft = await seedDraft(env, a.id, { title: 'before' });
    const before = await row(env, draft.id);

    const res = await a.device.patch(`/api/me/drafts/${draft.id}`, {
      title: 'after',
      id: 'cother000000000000000000',
      authorId: b.id,
      slug: 'hijacked',
      deletedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      publishedTitle: 'hijacked',
      draftContent: 'hijacked',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(draft.id);
    const after = await row(env, draft.id);
    expect(after.title).toBe('after');
    expect(after.authorId).toBe(a.id);
    expect(after.slug).toBe(before.slug);
    expect(after.deletedAt).toBeNull();
    expect(after.publishedAt).toBeNull();
    expect(after.publishedTitle).toBeNull();
    expect(Buffer.compare(after.draftContent!, before.draftContent!)).toBe(0);
  });

  test('a missing, someone else\'s or deleted draft gives the same 404, and nothing changes', async ({ env }) => {
    const { a, b } = await twoUsers(env);
    const theirs = await seedDraft(env, b.id, { title: 'theirs' });
    const deleted = await seedDraft(env, a.id, { title: 'deleted', deleted: true });

    for (const id of [theirs.id, deleted.id, 'cdoesnotexist000000000000']) {
      const res = await a.device.patch(`/api/me/drafts/${id}`, { title: 'hijacked' });
      expect(res.statusCode, id).toBe(404);
      expect(res.json(), id).toEqual(NOT_FOUND);
    }
    expect((await row(env, theirs.id)).title).toBe('theirs');
    expect((await row(env, deleted.id)).title, 'a deleted draft cannot be edited back to life').toBe('deleted');
  });
});

describe('DELETE /api/me/drafts/:id', () => {
  test('soft-deletes: the row and content stay, but the draft disappears from every read', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const content = docToDraftBytes();
    const draft = await seedDraft(env, id, { content });
    const sibling = await seedDraft(env, id);

    const res = await device.delete(`/api/me/drafts/${draft.id}`);

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    const saved = await row(env, draft.id);
    expect(saved.deletedAt).not.toBeNull();
    expect(Buffer.compare(saved.draftContent!, content), 'content is retained').toBe(0);

    expect((await device.get(`/api/me/drafts/${draft.id}`)).statusCode).toBe(404);
    expect((await device.patch(`/api/me/drafts/${draft.id}`, { title: 'x' })).statusCode).toBe(404);
    expect(idsOf(await device.get('/api/me/drafts'))).toEqual([sibling.id]);
    expect((await row(env, sibling.id)).deletedAt, 'siblings are untouched').toBeNull();
  });

  test('is idempotent and does not move the original deletion time', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const draft = await seedDraft(env, id);

    await device.delete(`/api/me/drafts/${draft.id}`);
    const firstDeletedAt = (await row(env, draft.id)).deletedAt;
    const again = await device.delete(`/api/me/drafts/${draft.id}`);

    expect(again.statusCode).toBe(204);
    expect((await row(env, draft.id)).deletedAt).toEqual(firstDeletedAt);
  });

  test('a missing or someone else\'s draft returns 204 like any other, and deletes nothing', async ({ env }) => {
    const { a, b } = await twoUsers(env);
    const theirs = await seedDraft(env, b.id);

    const real = await a.device.delete(`/api/me/drafts/${theirs.id}`);
    const fake = await a.device.delete('/api/me/drafts/cdoesnotexist000000000000');

    expect(real.statusCode).toBe(204);
    expect(fake.statusCode).toBe(204);
    expect(real.body).toBe(fake.body);
    expect((await row(env, theirs.id)).deletedAt, 'their draft must survive').toBeNull();
    expect(idsOf(await b.device.get('/api/me/drafts'))).toEqual([theirs.id]);
  });
});

describe('hostile ids', () => {
  // Raw, already-encoded path segments. A bad id must be a clean 4xx, never a 500 from the database.
  const hostileIds = [
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

  test('never cause a 5xx on any route and never expose or alter data', async ({ env }) => {
    const { a, b } = await twoUsers(env);
    const mine = await seedDraft(env, a.id, { title: 'mine' });
    const theirs = await seedDraft(env, b.id, { title: 'theirs' });
    const postsBefore = await env.app.prisma.post.count();

    for (const id of hostileIds) {
      const get = await a.device.get(`/api/me/drafts/${id}`);
      const patch = await a.device.patch(`/api/me/drafts/${id}`, { title: 'x' });
      const del = await a.device.delete(`/api/me/drafts/${id}`);

      expect([400, 404], `GET ${id} -> ${get.statusCode}`).toContain(get.statusCode);
      expect([400, 404], `PATCH ${id} -> ${patch.statusCode}`).toContain(patch.statusCode);
      expect([204, 400, 404], `DELETE ${id} -> ${del.statusCode}`).toContain(del.statusCode);
      for (const res of [get, patch, del]) {
        expect(res.body, id).not.toMatch(/prisma|postgres|invalid byte|node_modules|\bat .*:\d+:\d+/i);
      }
    }

    expect(await env.app.prisma.post.count()).toBe(postsBefore);
    expect((await row(env, mine.id)).title).toBe('mine');
    expect((await row(env, theirs.id)).deletedAt).toBeNull();
    expect((await row(env, mine.id)).deletedAt).toBeNull();
  });
});
