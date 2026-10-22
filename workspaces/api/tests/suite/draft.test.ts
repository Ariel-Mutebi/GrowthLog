import { createId } from '@paralleldrive/cuid2';
import { describe, expect } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
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
const NOW = () => new Date().toISOString();

const draftsOf = (res: LightMyRequestResponse) => res.json() as Draft[];
const idsOf = (res: LightMyRequestResponse) => draftsOf(res).map((d) => d.id);
const row = (env: TestEnv, id: string) => env.app.prisma.post.findUniqueOrThrow({ where: { id } });
const postCount = (env: TestEnv) => env.app.prisma.post.count();

/** Only authoring metadata may reach the client: never content, author, deletion state or published fields. */
function expectMetadataOnly(value: unknown) {
  const draft = value as Record<string, unknown>;
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

describe('authentication', () => {
  test.for([
    { name: 'POST /api/me/drafts', call: (d: Device) => d.post('/api/me/drafts') },
    { name: 'GET /api/me/drafts', call: (d: Device) => d.get('/api/me/drafts') },
    { name: 'GET /api/me/drafts/:id', call: (d: Device, id: string) => d.get(`/api/me/drafts/${id}`) },
    { name: 'PATCH /api/me/drafts/:id', call: (d: Device, id: string) => d.patch(`/api/me/drafts/${id}`, { title: 'x' }) },
    { name: 'DELETE /api/me/drafts/:id', call: (d: Device, id: string) => d.delete(`/api/me/drafts/${id}`) },
  ])('$name requires a session and changes nothing', async ({ call }, { env }) => {
    const { id } = await signedInDevice(env);
    const draft = await seedDraft(env, id, { title: 'mine' });
    const before = await postCount(env);

    const res = await call(env.device(), draft.id);

    expect(res.statusCode).toBe(401);
    expect(await postCount(env), 'nothing may be created').toBe(before);
    const saved = await row(env, draft.id);
    expect(saved.title).toBe('mine');
    expect(saved.deletedAt).toBeNull();
  });
});

describe('POST /api/me/drafts', () => {
  test('creates an untitled draft owned by the caller, exposing metadata only', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await device.post('/api/me/drafts');

    expect(res.statusCode).toBe(201);
    const body = res.json() as Draft;
    expectMetadataOnly(body);
    expect(body.title).toBe('Untitled');
    expect(body.slug).toMatch(/^untitled-\d{4}$/);
    expect(body.publishedAt ?? null).toBeNull();

    const saved = await row(env, body.id);
    expect(saved.authorId).toBe(id);
    expect(saved.deletedAt).toBeNull();
    expect(saved.draftContent, 'a new draft starts with no content').toBeNull();
    expect(saved.publishedAt).toBeNull();
  });

  test('ignores any body, since the endpoint takes no input', async ({ env }) => {
    const { a, b } = await twoUsers(env);

    const res = await a.device.post('/api/me/drafts', {
      title: 'Chosen',
      slug: 'chosen',
      authorId: b.id,
      publishedAt: NOW(),
      deletedAt: NOW(),
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
    // This test may be a false positive about 50% of the time, but it is a compromise to
    // avoid timing out. Currently, there is a maximum of 9000 unique 'untitled' slugs.
    await env.app.prisma.post.createMany({
      data: Array.from({ length: 4500 }, (_, i) => ({
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
    for (const d of draftsOf(res)) expectMetadataOnly(d);
    expect(idsOf(await b.device.get('/api/me/drafts'))).toEqual([theirs.id]);
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

  test('rejects unknown parameters and invalid sort, order and filter values with 400', async ({ env }) => {
    const { device } = await signedInDevice(env);

    const bad = [
      // Parameters that would widen the result to other users or to deleted drafts.
      'authorId=someone', 'userId=someone', 'deleted=true', 'includeDeleted=true', 'all=true',
      // Invalid values for the parameters that do exist.
      'sortBy=slug', 'sortBy=createdAt', 'sortBy=id', 'sortBy=', 'sortBy=title;DROP', 'sortBy=__proto__',
      'sortBy[]=title', 'sortBy=title&sortBy=updatedAt',
      'order=ASC', 'order=up', 'order=', 'order=asc&order=desc',
      'published=yes', 'published=2', 'published=true&published=false',
    ];
    for (const qs of bad) {
      const res = await device.get(`/api/me/drafts?${qs}`);
      expect(res.statusCode, qs).toBe(400);
      expect(Array.isArray(res.json()), `${qs} must not return a list`).toBe(false);
    }
  });
});

describe('GET /api/me/drafts/:id', () => {
  test('returns a draft or a published post as metadata only, the latter with its publishedAt', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const draft = await seedDraft(env, id, { title: 'mine' });
    const post = await seedDraft(env, id, { published: true });

    const draftRes = await device.get(`/api/me/drafts/${draft.id}`);
    const postRes = await device.get(`/api/me/drafts/${post.id}`);

    expect(draftRes.statusCode).toBe(200);
    expectMetadataOnly(draftRes.json());
    expect(draftRes.json()).toMatchObject({ id: draft.id, title: 'mine', slug: draft.slug });

    expect(postRes.statusCode).toBe(200);
    expectMetadataOnly(postRes.json());
    expect(Date.parse((postRes.json() as Draft).publishedAt!)).not.toBeNaN();
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

  // The limit of 20 is inferred from the over-long cases below, which start at 21.
  test('accepts titles of 1 and 20 characters', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const draft = await seedDraft(env, id);

    for (const title of ['a', 'b'.repeat(20)]) {
      const res = await device.patch(`/api/me/drafts/${draft.id}`, { title });
      expect(res.statusCode, `${title.length} characters: ${res.body}`).toBe(200);
      expect((await row(env, draft.id)).title).toBe(title);
    }
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

  // Each field is sent on its own, next to a valid title, for the same reason as on POST.
  test('rejects attempts to change any other field with 400, and changes nothing', async ({ env }) => {
    const { a, b } = await twoUsers(env);
    const draft = await seedDraft(env, a.id, { title: 'before' });
    const before = await row(env, draft.id);
    const forbidden = {
      id: createId(),
      authorId: b.id,
      slug: 'hijacked',
      deletedAt: NOW(),
      publishedAt: NOW(),
      publishedTitle: 'hijacked',
      draftContent: 'hijacked',
    };

    for (const [field, value] of Object.entries(forbidden)) {
      const res = await a.device.patch(`/api/me/drafts/${draft.id}`, { title: 'after', [field]: value });
      expect(res.statusCode, `${field}: ${res.body}`).toBe(400);
    }

    expect(await row(env, draft.id), 'no rejected request may change the row').toEqual(before);
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
});

// Whether a draft is missing, someone else's, or deleted must be indistinguishable, so nothing leaks about
// other people's drafts. DELETE is idempotent, so it answers 204 for all of them (and keeps the original
// deletion time of an already-deleted draft).
describe('drafts that are missing, someone else\'s or deleted', () => {
  test.for([
    { method: 'GET', status: 404, call: (d: Device, id: string) => d.get(`/api/me/drafts/${id}`) },
    { method: 'PATCH', status: 404, call: (d: Device, id: string) => d.patch(`/api/me/drafts/${id}`, { title: 'hijacked' }) },
    { method: 'DELETE', status: 204, call: (d: Device, id: string) => d.delete(`/api/me/drafts/${id}`) },
  ])('$method answers all three identically with $status, and changes nothing', async ({ status, call }, { env }) => {
    const { a, b } = await twoUsers(env);
    const theirs = await seedDraft(env, b.id, { title: 'theirs' });
    const deleted = await seedDraft(env, a.id, { title: 'deleted', deleted: true });
    const missing = createId();
    const snapshot = async (id: string) => {
      const { title, deletedAt } = await row(env, id);
      return { title, deletedAt };
    };
    const before = [await snapshot(theirs.id), await snapshot(deleted.id)];

    const responses = await Promise.all([theirs.id, deleted.id, missing].map((id) => call(a.device, id)));

    for (const res of responses) {
      expect(res.statusCode, res.body).toBe(status);
      expect(res.body, 'the bodies must not differ').toBe(responses[0]!.body);
    }
    if (status === 404) expect(responses[0]!.json()).toEqual(NOT_FOUND);
    expect([await snapshot(theirs.id), await snapshot(deleted.id)], 'nothing may change').toEqual(before);
    expect(idsOf(await b.device.get('/api/me/drafts')), 'their draft must survive').toEqual([theirs.id]);
  });
});

describe('hostile ids', () => {
  // Raw, already-encoded path segments. Ids must be well-formed cuid2s, so every one of these is a client
  // error before the database is reached. The exact code varies (400 from validation, 414 from the router for
  // the very long one), so the test pins the class: a clean 4xx, never a 5xx, and no data exposed or altered.
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
    const postsBefore = await postCount(env);

    for (const id of hostileIds) {
      const get = await a.device.get(`/api/me/drafts/${id}`);
      const patch = await a.device.patch(`/api/me/drafts/${id}`, { title: 'x' });
      const del = await a.device.delete(`/api/me/drafts/${id}`);

      for (const [method, res] of [['GET', get], ['PATCH', patch], ['DELETE', del]] as const) {
        const label = `${method} ${id.slice(0, 40)} -> ${res.statusCode}`;
        expect(res.statusCode, label).toBeGreaterThanOrEqual(400);
        expect(res.statusCode, label).toBeLessThan(500);
        expect(res.body, label).not.toMatch(/prisma|postgres|invalid byte|node_modules|\bat .*:\d+:\d+/i);
      }
    }

    expect(await postCount(env)).toBe(postsBefore);
    expect((await row(env, mine.id)).title).toBe('mine');
    expect((await row(env, theirs.id)).deletedAt).toBeNull();
    expect((await row(env, mine.id)).deletedAt).toBeNull();
  });
});
