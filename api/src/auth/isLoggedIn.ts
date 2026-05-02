import type { preValidationHookHandler } from 'fastify';
import type { Authenticator } from '@fastify/passport';

// Avoid repetitive type cast
export const isLoggedIn =
  (auth: Authenticator): preValidationHookHandler =>
    auth.authenticate('session');
