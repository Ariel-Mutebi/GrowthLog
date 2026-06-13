import type { preValidationHookHandler } from 'fastify';
import type { Authenticator } from '@fastify/passport';

/**
 * Avoid repetitive type casting (e.g. app.auth.authenticate('session`) as preValidationHookHandler).
 */
export const isLoggedIn = (auth: Authenticator): preValidationHookHandler => auth.authenticate('session');
export const localStrategy = (auth: Authenticator): preValidationHookHandler => auth.authenticate('local');
