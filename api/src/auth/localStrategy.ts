import type { PrismaClient } from '../db/client.js';
import type { createClient } from 'redis';
import { Strategy } from 'passport-local';
import { compare } from 'bcrypt';

/**
 * Timing attack hardening: always run compare — even when no user is found — so
 * response time is consistent, regardless of whether the email is registered.
 */
const DUMMY_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

export function buildLocalStrategy(
  prisma: PrismaClient,
  redis: ReturnType<typeof createClient>,
) {
  return new Strategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      // Distributed brute force hardening: maximum of 5 login attempts per email in 15 minutes.
      const key = `failed_login:${email}`;
      const attempts = Number(await redis.get(key));

      if (attempts >= 5) {
        return done(null, false, { message: 'Account temporarily locked' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      const match = await compare(password, user?.password ?? DUMMY_HASH);

      if (!user || !match) {
        const newAttempts = await redis.incr(key);
        if (newAttempts === 1) {
          await redis.expire(key, 15 * 60);
        }
        return done(null, false, { message: 'Invalid email or password' });
      }

      await redis.del(key);
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  });
}
