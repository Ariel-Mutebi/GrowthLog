import { PrismaClient } from '../../prisma/generated/client.js';
import { Strategy } from 'passport-local';
import { compare } from 'bcrypt';

export function buildLocalStrategy(prisma: PrismaClient) {
  return new Strategy(async (username, password, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          username,
        },
      });

      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      const passwordsMatch = await compare(password, user.password);

      if (!passwordsMatch) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      return done(null, user);
    } catch (error) {
      done(error);
    }
  });
}
