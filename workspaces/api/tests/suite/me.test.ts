import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import {
  ADA_LOGIN,
  GRACE,
  SESSION,
  STRONG_PASSWORD,
  WRONG_PASSWORD,
  confirmPassword,
  deleteAccount,
  newUser,
  profileWithSession,
  register,
  sessionOf,
  signedInDevice,
} from './helpers/user.js';

const WEAK_PASSWORD = 'passwordpassword';
const NEW_PASSWORD = 'purple-monkey-dishwasher-telescope-58';
const wrongAttempt = { passwordAttempt: WRONG_PASSWORD };

const getMe = (device: Device) => device.get('/api/me');
const patchMe = (device: Device, body: Record<string, unknown>) => device.patch('/api/me', body);
const deleteMe = (device: Device, body?: Record<string, unknown>) => device.delete('/api/me', body);
const userRow = (env: TestEnv, id: string) => env.app.prisma.user.findUniqueOrThrow({ where: { id } });
const login = (env: TestEnv, creds: { email: string; password: string }) =>
  env.device().post('/api/sessions', creds);

/** Signs the same account in on a second device. */
async function secondDevice(env: TestEnv) {
  const device = env.device();
  const res = await device.post('/api/sessions', ADA_LOGIN);
  expect(res.statusCode, `second login failed: ${res.body}`).toBe(200);
  return device;
}

describe('GET /api/me', () => {
  test('requires a session', async ({ env }) => {
    const res = await getMe(env.device());
    expect(res.statusCode).toBe(401);
  });

  test('returns the signed-in user without secrets', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await getMe(device);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id,
      email: ADA_LOGIN.email,
      username: 'ada-lovelace',
      forename: 'Ada',
      surname: 'Lovelace',
      avatarKey: null,
    });
    for (const secret of ['password', 'deletedAt', 'sessionsRevokedAt', 'emailVerificationCode']) {
      expect(res.json(), `"${secret}" must not be exposed`).not.toHaveProperty(secret);
    }
  });

  test('returns each user their own account, not anyone else’s', async ({ env }) => {
    const ada = await signedInDevice(env);
    const grace = await signedInDevice(env, GRACE);

    expect((await getMe(ada.device)).json().id).toBe(ada.id);
    expect((await getMe(grace.device)).json().id).toBe(grace.id);
  });
});

describe('PATCH /api/me', () => {
  test('requires a session', async ({ env }) => {
    const res = await patchMe(env.device(), { forename: 'Augusta' });
    expect(res.statusCode).toBe(401);
  });

  describe('profile fields', () => {
    test('updates them without asking for the password', async ({ env }) => {
      const { device, id } = await signedInDevice(env);

      const res = await patchMe(device, { forename: 'Augusta', bio: 'Analyst and metaphysician' });

      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({ id, forename: 'Augusta', bio: 'Analyst and metaphysician' });
      expect(res.json()).not.toHaveProperty('password');

      expect((await getMe(device)).json()).toMatchObject({ forename: 'Augusta', surname: 'Lovelace' });
      expect(await userRow(env, id)).toMatchObject({
        forename: 'Augusta',
        surname: 'Lovelace',
        bio: 'Analyst and metaphysician',
      });
    });

    test('only changes the signed-in user’s row', async ({ env }) => {
      const ada = await signedInDevice(env);
      const grace = await signedInDevice(env, GRACE);

      await patchMe(ada.device, { forename: 'Augusta' });

      expect((await userRow(env, grace.id)).forename).toBe('Grace');
    });

    test('changes the username without the password and frees the old one', async ({ env }) => {
      const { device, id } = await signedInDevice(env);

      const res = await patchMe(device, { username: 'countess-of-lovelace' });

      expect(res.statusCode, res.body).toBe(200);
      expect((await userRow(env, id)).username).toBe('countess-of-lovelace');
      // Registration asserts 201, so this proves the old username is available again.
      await register(env.device(), { ...GRACE, username: 'ada-lovelace' });
    });

    test('ignores fields a client must not set', async ({ env }) => {
      const { device, id } = await signedInDevice(env);
      const other = await secondDevice(env);
      const before = await userRow(env, id);

      // The service spreads the validated body into the Prisma update, so the schema is the only guard.
      const res = await patchMe(device, {
        forename: 'Augusta',
        id: randomUUID(),
        createdAt: '2000-01-01T00:00:00.000Z',
        deletedAt: '2000-01-01T00:00:00.000Z',
        emailVerifiedAt: '2000-01-01T00:00:00.000Z',
        sessionsRevokedAt: '2999-01-01T00:00:00.000Z',
      });

      expect(res.statusCode, res.body).toBe(200);
      const after = await userRow(env, id); // throws if the id was overwritten
      expect(after.forename).toBe('Augusta');
      expect(after.createdAt).toEqual(before.createdAt);
      expect(after.deletedAt).toBeNull();
      expect(after.emailVerifiedAt).toBeNull();
      expect(after.sessionsRevokedAt).toBeNull();
      expect((await getMe(other)).statusCode, 'a client-supplied revocation must not sign anyone out').toBe(200);
    });
  });

  describe('conflicts', () => {
    test('rejects a username that is already taken with 409', async ({ env }) => {
      await register(env.device(), GRACE);
      const { device, id } = await signedInDevice(env);

      const res = await patchMe(device, { username: GRACE.username });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        error: 'Conflict',
        message: 'The username or email you want to change to is already in use',
      });
      expect((await userRow(env, id)).username).toBe('ada-lovelace');
    });

    test('rejects an email that is already taken with 409', async ({ env }) => {
      await register(env.device(), GRACE);
      const { device, id } = await signedInDevice(env);

      const res = await patchMe(device, { email: GRACE.email, ...confirmPassword });

      expect(res.statusCode).toBe(409);
      expect((await userRow(env, id)).email).toBe(ADA_LOGIN.email);
    });

    test('a username held by a soft-deleted account is still taken', async ({ env }) => {
      const grace = await signedInDevice(env, GRACE);
      await deleteAccount(grace.device);
      const { device } = await signedInDevice(env);

      const res = await patchMe(device, { username: GRACE.username });

      expect(res.statusCode, 'the account is recoverable, so its username stays reserved').toBe(409);
    });

    test('a conflict applies none of the other fields in the same request', async ({ env }) => {
      await register(env.device(), GRACE);
      const { device, id } = await signedInDevice(env);

      const res = await patchMe(device, { forename: 'Augusta', username: GRACE.username });

      expect(res.statusCode).toBe(409);
      expect((await userRow(env, id)).forename, 'the update must be all-or-nothing').toBe('Ada');
    });

    test('two users racing for the same username: one wins, one gets 409', async ({ env }) => {
      const ada = await signedInDevice(env);
      const grace = await signedInDevice(env, GRACE);

      const [a, b] = await Promise.all([
        patchMe(ada.device, { username: 'contested' }),
        patchMe(grace.device, { username: 'contested' }),
      ]);

      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      expect(await env.app.prisma.user.count({ where: { username: 'contested' } })).toBe(1);
    });
  });

  describe('email', () => {
    test('requires the current password', async ({ env }) => {
      const { device, id } = await signedInDevice(env);

      const missing = await patchMe(device, { email: GRACE.email });
      const wrong = await patchMe(device, { email: GRACE.email, ...wrongAttempt });

      expect(missing.statusCode).toBe(403);
      expect(wrong.statusCode).toBe(403);
      expect(wrong.json()).toMatchObject({
        error: 'Forbidden',
        message: 'Provide your current password to make this update',
      });
      expect((await userRow(env, id)).email).toBe(ADA_LOGIN.email);
    });

    test('changes when the current password is right, and logs in with the new address only', async ({ env }) => {
      const { device } = await signedInDevice(env);

      const res = await patchMe(device, { email: GRACE.email, ...confirmPassword });

      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().email).toBe(GRACE.email);
      expect((await login(env, { email: GRACE.email, password: STRONG_PASSWORD })).statusCode).toBe(200);
      expect((await login(env, ADA_LOGIN)).statusCode, 'the old address no longer logs in').toBe(401);
    });

    test('rejects a malformed address with 400', async ({ env }) => {
      const { device, id } = await signedInDevice(env);

      const res = await patchMe(device, { email: 'not-an-email', ...confirmPassword });

      expect(res.statusCode, res.body).toBe(400);
      expect((await userRow(env, id)).email).toBe(ADA_LOGIN.email);
    });

    // PersonalService writes the new address but never touches emailVerifiedAt, so this is expected to
    // fail today: a verified flag would carry over to an address nobody has verified.
    test('clears the verified flag, since the new address is unverified', async ({ env }) => {
      const { device, id } = await signedInDevice(env);
      await env.app.prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });

      const res = await patchMe(device, { email: GRACE.email, ...confirmPassword });

      expect(res.statusCode, res.body).toBe(200);
      expect((await userRow(env, id)).emailVerifiedAt).toBeNull();
    });
  });

  describe('password', () => {
    test('requires the current password', async ({ env }) => {
      const { device } = await signedInDevice(env);

      const missing = await patchMe(device, { password: NEW_PASSWORD });
      const wrong = await patchMe(device, { password: NEW_PASSWORD, ...wrongAttempt });

      expect(missing.statusCode).toBe(403);
      expect(wrong.statusCode).toBe(403);
      expect((await login(env, ADA_LOGIN)).statusCode, 'the old password still works').toBe(200);
    });

    test('changes it, stores it hashed, and never echoes it back', async ({ env }) => {
      const { device, id } = await signedInDevice(env);

      const res = await patchMe(device, { password: NEW_PASSWORD, ...confirmPassword });

      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).not.toHaveProperty('password');
      const { password: stored } = await userRow(env, id);
      expect(stored).not.toBe(NEW_PASSWORD);
      expect(stored).toMatch(/^\$2[aby]\$\d{2}\$/);

      expect((await login(env, { ...ADA_LOGIN, password: NEW_PASSWORD })).statusCode).toBe(200);
      expect((await login(env, ADA_LOGIN)).statusCode, 'the old password no longer logs in').toBe(401);
    });

    test('rejects a weak new password with 400, keeps the old one, and applies nothing else', async ({ env }) => {
      const { device, id } = await signedInDevice(env);

      const res = await patchMe(device, { forename: 'Augusta', password: WEAK_PASSWORD, ...confirmPassword });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: 'BadRequest',
        message: 'Your desired new password is too weak',
      });
      expect((await userRow(env, id)).forename, 'the whole update is rejected').toBe('Ada');
      expect((await login(env, ADA_LOGIN)).statusCode).toBe(200);
    });

    test('checks the current password before judging the new one', async ({ env }) => {
      const { device } = await signedInDevice(env);

      const res = await patchMe(device, { password: WEAK_PASSWORD, ...wrongAttempt });

      expect(res.statusCode, 'a wrong attempt gets 403, not feedback about the new password').toBe(403);
    });
  });

  describe('password change revokes sessions', () => {
    test('signs out the other devices, which can then log in with the new password', async ({ env }) => {
      const { device: changer } = await signedInDevice(env);
      const other = await secondDevice(env);
      expect((await getMe(other)).statusCode, 'signed in before the change').toBe(200);

      const res = await patchMe(changer, { password: NEW_PASSWORD, ...confirmPassword });
      expect(res.statusCode, res.body).toBe(200);

      expect((await getMe(other)).statusCode, 'the other device is signed out').toBe(401);

      const relogin = env.device();
      const loggedIn = await relogin.post('/api/sessions', { ...ADA_LOGIN, password: NEW_PASSWORD });
      expect(loggedIn.statusCode).toBe(200);
      expect((await getMe(relogin)).statusCode, 'a session issued after the change works').toBe(200);
    });

    test('keeps the device that changed the password signed in, on a new session id', async ({ env }) => {
      const { device } = await signedInDevice(env);
      const before = sessionOf(device);

      const res = await patchMe(device, { password: NEW_PASSWORD, ...confirmPassword });
      expect(res.statusCode, res.body).toBe(200);

      expect(sessionOf(device), 'the session id rotates').not.toBe(before);
      expect((await getMe(device)).statusCode, 'the new session works').toBe(200);
      expect((await profileWithSession(env, before)).statusCode, 'the old id is dead').toBe(401);
    });

    test('records the revocation time, and only a password change does', async ({ env }) => {
      const { device, id } = await signedInDevice(env);
      expect((await userRow(env, id)).sessionsRevokedAt).toBeNull();

      await patchMe(device, { forename: 'Augusta' });
      expect((await userRow(env, id)).sessionsRevokedAt, 'profile edits do not revoke').toBeNull();

      await patchMe(device, { password: NEW_PASSWORD, ...confirmPassword });
      expect((await userRow(env, id)).sessionsRevokedAt, 'a password change does').not.toBeNull();
    });

    test('a rejected password change signs nobody out', async ({ env }) => {
      const { device: changer } = await signedInDevice(env);
      const other = await secondDevice(env);
      const before = sessionOf(changer);

      const res = await patchMe(changer, { password: NEW_PASSWORD, ...wrongAttempt });

      expect(res.statusCode).toBe(403);
      expect((await getMe(changer)).statusCode).toBe(200);
      expect(sessionOf(changer), 'no rotation without a change').toBe(before);
      expect((await getMe(other)).statusCode).toBe(200);
    });

    test('a weak-password rejection signs nobody out', async ({ env }) => {
      const { device: changer } = await signedInDevice(env);
      const other = await secondDevice(env);

      const res = await patchMe(changer, { password: WEAK_PASSWORD, ...confirmPassword });

      expect(res.statusCode).toBe(400);
      expect((await getMe(changer)).statusCode).toBe(200);
      expect((await getMe(other)).statusCode).toBe(200);
    });

    test.for([
      ['a profile update', { forename: 'Augusta' }],
      ['an email change', { email: GRACE.email, ...confirmPassword }],
    ] as const)('%s signs nobody out and keeps the session id', async ([, body], { env }) => {
      const { device: editor } = await signedInDevice(env);
      const other = await secondDevice(env);
      const before = sessionOf(editor);

      const res = await patchMe(editor, body);

      expect(res.statusCode, res.body).toBe(200);
      expect(sessionOf(editor)).toBe(before);
      expect((await getMe(other)).statusCode).toBe(200);
    });
  });
});

describe('DELETE /api/me', () => {
  test('requires a session and changes nothing', async ({ env }) => {
    const { id } = await signedInDevice(env);

    const res = await deleteMe(env.device(), confirmPassword);

    expect(res.statusCode).toBe(401);
    expect((await userRow(env, id)).deletedAt).toBeNull();
  });

  test('requires passwordAttempt in the body', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await deleteMe(device);

    expect(res.statusCode).toBe(400);
    expect((await userRow(env, id)).deletedAt).toBeNull();
    expect((await getMe(device)).statusCode, 'still signed in').toBe(200);
  });

  test('rejects a wrong password with 403 and leaves the account and session intact', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await deleteMe(device, wrongAttempt);

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      error: 'Forbidden',
      message: 'Please provide your current password to delete your account',
    });
    expect((await userRow(env, id)).deletedAt).toBeNull();
    expect((await getMe(device)).statusCode, 'still signed in').toBe(200);
  });

  test('soft-deletes the account, destroys the session and clears the cookie', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const sessionId = sessionOf(device);

    const res = await deleteMe(device, confirmPassword);

    expect(res.statusCode, res.body).toBe(204);
    expect(res.body, '204 must have an empty body').toBe('');

    const user = await userRow(env, id);
    expect(user.deletedAt, 'the row is kept, only marked deleted').not.toBeNull();
    expect(Date.now() - (user.deletedAt as Date).getTime(), 'deletedAt is the deletion time').toBeLessThan(10_000);

    expect(device.cookies.has(SESSION), 'the cookie is cleared').toBe(false);
    // Replaying the old id proves the session is gone server-side, not just forgotten by the client.
    expect((await profileWithSession(env, sessionId)).statusCode).toBe(401);
  });

  test('does not touch anyone else’s account', async ({ env }) => {
    const ada = await signedInDevice(env);
    const grace = await signedInDevice(env, GRACE);

    await deleteMe(ada.device, confirmPassword);

    expect((await userRow(env, grace.id)).deletedAt).toBeNull();
    expect((await getMe(grace.device)).statusCode).toBe(200);
  });

  test('keeps the email and username reserved while the account is recoverable', async ({ env }) => {
    const { device } = await signedInDevice(env);
    await deleteAccount(device);

    const res = await env.device().post('/api/users', newUser());

    expect(res.statusCode).toBe(409);
  });

  test('a restored account can be deleted again', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    await deleteAccount(device);

    const restored = await secondDevice(env); // logging in inside the window restores the account
    expect((await userRow(env, id)).deletedAt, 'restored').toBeNull();

    const res = await deleteMe(restored, confirmPassword);

    expect(res.statusCode, res.body).toBe(204);
    expect((await userRow(env, id)).deletedAt).not.toBeNull();
  });

  test('parallel deletes from one session never fail with a 5xx', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const responses = await Promise.all([deleteMe(device, confirmPassword), deleteMe(device, confirmPassword)]);

    for (const res of responses) {
      expect([204, 401], `unexpected ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
    }
    expect((await userRow(env, id)).deletedAt).not.toBeNull();
  });
});

describe('password confirmation lockout', () => {
  const NEW_EMAIL = 'augusta@example.com';
  const OTHER_EMAIL = 'augusta.king@example.com';
  const MAX_ATTEMPTS = 5;

  const wrongEmailChange = (device: Device) => patchMe(device, { email: NEW_EMAIL, ...wrongAttempt });

  /** Makes `count` wrong guesses, asserting each is evaluated and rejected with a plain 403. */
  async function failPrompt(device: Device, count: number) {
    for (let i = 0; i < count; i++) {
      const res = await wrongEmailChange(device);
      expect(res.statusCode, `attempt ${i + 1} should be a plain 403`).toBe(403);
    }
  }

  test('answers 423 once the attempts are used up, even for the right password', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    await failPrompt(device, MAX_ATTEMPTS);

    const locked = await patchMe(device, { email: NEW_EMAIL, ...confirmPassword });

    expect(locked.statusCode, locked.body).toBe(423);
    expect(locked.json()).toMatchObject({ error: 'Locked' });
    expect(locked.json().message).toEqual(expect.any(String));
    expect((await userRow(env, id)).email, 'the change must not be applied').toBe(ADA_LOGIN.email);
  });

  test('answers 423 to a further wrong password too, so no guess is evaluated while locked', async ({ env }) => {
    const { device } = await signedInDevice(env);
    await failPrompt(device, MAX_ATTEMPTS);

    const res = await wrongEmailChange(device);

    expect(res.statusCode, 'a locked prompt must not say whether the guess was right').toBe(423);
  });

  test('stays locked for every further attempt', async ({ env }) => {
    const { device } = await signedInDevice(env);
    await failPrompt(device, MAX_ATTEMPTS);

    for (let i = 0; i < 3; i++) {
      const res = await patchMe(device, { email: NEW_EMAIL, ...confirmPassword });
      expect(res.statusCode, `attempt ${MAX_ATTEMPTS + i + 1}`).toBe(423);
    }
  });

  test('the last permitted attempt is still evaluated', async ({ env }) => {
    const { device } = await signedInDevice(env);
    await failPrompt(device, MAX_ATTEMPTS - 1);

    const res = await patchMe(device, { email: NEW_EMAIL, ...confirmPassword });

    expect(res.statusCode, res.body).toBe(200);
  });

  test('a correct password resets the counter', async ({ env }) => {
    const { device } = await signedInDevice(env);
    await failPrompt(device, MAX_ATTEMPTS - 1);
    expect((await patchMe(device, { email: NEW_EMAIL, ...confirmPassword })).statusCode).toBe(200);

    await failPrompt(device, MAX_ATTEMPTS - 1);

    // Without the reset this would be attempt #10 and locked.
    const res = await patchMe(device, { email: OTHER_EMAIL, ...confirmPassword });
    expect(res.statusCode, res.body).toBe(200);
  });

  test('is shared by email changes, password changes and account deletion', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    expect((await patchMe(device, { email: NEW_EMAIL, ...wrongAttempt })).statusCode).toBe(403);
    expect((await patchMe(device, { password: NEW_PASSWORD, ...wrongAttempt })).statusCode).toBe(403);
    expect((await deleteMe(device, wrongAttempt)).statusCode).toBe(403);
    expect((await patchMe(device, { password: NEW_PASSWORD, ...wrongAttempt })).statusCode).toBe(403);
    expect((await deleteMe(device, wrongAttempt)).statusCode).toBe(403);

    const locked = await deleteMe(device, confirmPassword);

    expect(locked.statusCode, locked.body).toBe(423);
    expect((await userRow(env, id)).deletedAt, 'the account must survive').toBeNull();
    expect((await login(env, ADA_LOGIN)).statusCode, 'the old password is unchanged').toBe(200);
  });

  test('a locked account deletion leaves the account and session alone', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    await failPrompt(device, MAX_ATTEMPTS);

    const res = await deleteMe(device, confirmPassword);

    expect(res.statusCode, res.body).toBe(423);
    expect((await userRow(env, id)).deletedAt).toBeNull();
    expect((await getMe(device)).statusCode, 'still signed in').toBe(200);
  });

  test('a locked password change does not rotate the session or sign anyone out', async ({ env }) => {
    const { device } = await signedInDevice(env);
    const other = await secondDevice(env);
    const before = sessionOf(device);
    await failPrompt(device, MAX_ATTEMPTS);

    const res = await patchMe(device, { password: NEW_PASSWORD, ...confirmPassword });

    expect(res.statusCode, res.body).toBe(423);
    expect(sessionOf(device), 'no rotation without a change').toBe(before);
    expect((await getMe(device)).statusCode).toBe(200);
    expect((await getMe(other)).statusCode, 'other devices stay signed in').toBe(200);
    expect((await login(env, ADA_LOGIN)).statusCode, 'the old password still works').toBe(200);
  });

  test('is scoped to the account, not the IP or the whole server', async ({ env }) => {
    const ada = await signedInDevice(env);
    const grace = await signedInDevice(env, GRACE);
    await failPrompt(ada.device, MAX_ATTEMPTS);

    const res = await patchMe(grace.device, { email: NEW_EMAIL, ...confirmPassword });

    expect(res.statusCode, res.body).toBe(200);
  });

  test('does not block updates that need no password', async ({ env }) => {
    const { device } = await signedInDevice(env);
    await failPrompt(device, MAX_ATTEMPTS);

    const res = await patchMe(device, { forename: 'Augusta' });

    expect(res.statusCode, res.body).toBe(200);
  });

  test('does not lock the account out of logging in', async ({ env }) => {
    const { device } = await signedInDevice(env);
    await failPrompt(device, MAX_ATTEMPTS);

    expect((await login(env, ADA_LOGIN)).statusCode).toBe(200);
    expect((await getMe(device)).statusCode, 'the session itself stays valid').toBe(200);
  });

  test('a request that omits the password does not use up an attempt', async ({ env }) => {
    const { device } = await signedInDevice(env);

    for (let i = 0; i < MAX_ATTEMPTS * 2; i++) {
      const res = await patchMe(device, { email: NEW_EMAIL });
      expect(res.statusCode, `omitted-password request ${i + 1}`).toBe(403);
    }

    const res = await patchMe(device, { email: NEW_EMAIL, ...confirmPassword });
    expect(res.statusCode, res.body).toBe(200);
  });

  test('parallel guesses cannot exceed the attempt limit', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    // 20 simultaneous wrong guesses on one account. Only the first 5 may reach the password check.
    const responses = await Promise.all(Array.from({ length: 20 }, () => wrongEmailChange(device)));

    const statuses = responses.map((r) => r.statusCode);
    expect(statuses.filter((s) => s === 403), 'only 5 guesses may be evaluated').toHaveLength(MAX_ATTEMPTS);
    expect(statuses.filter((s) => s === 423), 'the rest are locked out').toHaveLength(20 - MAX_ATTEMPTS);

    const afterBurst = await patchMe(device, { email: NEW_EMAIL, ...confirmPassword });
    expect(afterBurst.statusCode, 'the burst must have locked the prompt').toBe(423);
    expect((await userRow(env, id)).email).toBe(ADA_LOGIN.email);
  });
});
