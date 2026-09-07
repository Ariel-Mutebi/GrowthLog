import jwt from 'jsonwebtoken';
import { config } from './config.js';

interface CollabTokenPayload {
  sub: string;
  name: string;
}

export function verifyCollabToken(token: string): CollabTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as CollabTokenPayload;
}
