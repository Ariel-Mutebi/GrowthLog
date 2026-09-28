import type { FastifyReply, FastifyRequest } from 'fastify';

export async function verifyJWT(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'This JWT is invalid or expired or malformed',
    });
  }
}
