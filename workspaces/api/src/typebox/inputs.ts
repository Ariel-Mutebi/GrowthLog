import { Type } from '@sinclair/typebox';

export const NameInput = Type.String({
  pattern: '^[A-Za-z]+$',
  minLength: 2,
  maxLength: 10,
});

export const BioInput = Type.String({
  minLength: 2,
  maxLength: 200,
});

/**
 * Username validation regex rationale:
 * 1. Lowercase ASCII Only ([a-z0-9]): Banned uppercase for consistency. Uses strict 
 *    ASCII ranges instead of \w to explicitly block Cyrillic homoglyph spoofing attacks.
 * 2. Allowed Symbols ([-._]): Permits hyphens, periods, and underscores to enhance 
 *    readability and name availability for users.
 * 3. Bookend Rule (^[a-z0-9] and [a-z0-9]$): Forces the string to start and end with an 
 *    alphanumeric character. Prevents issues with URL parsing (e.g., handles like "_john").
 * 4. No Consecutive Symbols (?=[a-z0-9]): Lookahead ensures a symbol is always followed 
 *    by an alphanumeric character. Blocks confusing duplicates like "john__doe" or "john..doe".
 * 5. Length Boundaries ({1,18}): Combined with the start and end characters, this strictly 
 *    enforces a minimum length of 2 and a maximum length of 20 characters.
 */
export const Username = Type.String({
  pattern: '^[a-z0-9](?:[a-z0-9]|[-._](?=[a-z0-9])){0,18}[a-z0-9]$',
});

export const Email = Type.String({ format: 'email' });
