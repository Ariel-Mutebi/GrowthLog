import { decodeJWT } from './decode.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

export function verifyJWT(req: FastifyRequest, res: FastifyReply) {
  const { token } = req.body as { token?: string };
  const payload = decodeJWT(token ?? '', req.server.config.JWT_SECRET);

  if (!payload) {
    res.code(401).send({
      error: 'Unauthorized',
      message: 'This JWT is invalid or expired or malformed',
    });
    return;
  }

  req.jwt = payload;
}
