import type { preValidationHookHandler } from 'fastify';
import type { Authenticator } from '@fastify/passport';

// Avoid repetitive type cast (i.e. app.auth.authenticate('session`) as preValidationHookHandler).
export const isLoggedIn = (auth: Authenticator): preValidationHookHandler => auth.authenticate('session');
