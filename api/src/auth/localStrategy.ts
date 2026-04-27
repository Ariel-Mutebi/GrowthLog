import { PrismaClient } from '../../prisma/generated/client.js';
import { Strategy } from 'passport-local';
import { compare } from 'bcrypt';

const DUMMY_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'; // prevent timing attack

export function buildLocalStrategy(prisma: PrismaClient) {
  return new Strategy(
    {
      usernameField: 'email',
    },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({where: { email } });
        const passwordsMatch = await compare(password, user?.password ?? DUMMY_HASH);

        if (!user || !passwordsMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    });
}
