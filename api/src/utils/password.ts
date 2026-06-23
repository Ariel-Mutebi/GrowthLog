import type { FastifyReply } from 'fastify';
import type { Static } from '@sinclair/typebox';
import type { BadRequest } from '../typebox/responses.js';

/**
 * Workaround for zxcvbn's broken ESM build as I wait for
 * my PR: https://github.com/KunalTanwar/zxcvbn-ts/pull/1
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const { zxcvbn } = require('zxcvbn-ts') as typeof import('zxcvbn-ts');

/**
 * Sends a 400 if the password is weak and returns `true`; returns `false`when
 * the password is strong enough. Callers should `return` on a truthy result to
 * halt the handler.
 */
export function rejectWeakPassword(password: string, res: FastifyReply): boolean {
  const { score, feedback } = zxcvbn(password);

  if (score < 3) {
    res.code(400).send({
      error: 'BadRequest',
      message: 'Password too weak',
      suggestions: feedback.suggestions as string[],
    } satisfies Static<typeof BadRequest>);
    return true;
  }

  return false;
}
