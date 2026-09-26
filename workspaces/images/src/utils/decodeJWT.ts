import jwt from 'jsonwebtoken';
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const JWTPayload = Type.Object({
  sub: Type.String(),
  name: Type.String(),
});

type JWTPayload = Static<typeof JWTPayload>;

export function decodeJWT(token: string, secret: string): JWTPayload | null {
  let decoded: unknown;

  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return null;
  }

  if (!Value.Check(JWTPayload, decoded)) {
    return null;
  }

  return decoded;
}
