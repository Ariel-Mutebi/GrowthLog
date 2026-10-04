import { Strategy } from 'passport-local';
import type { AuthService } from './authService.js';

export function buildLocalStrategy(authService: AuthService) {
  return new Strategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const result = await authService.login(email, password);
      if (result.status === 'ok') return done(null, result.user);
      return done(null, false, { message: result.status });
    } catch (error) {
      return done(error);
    }
  });
}
