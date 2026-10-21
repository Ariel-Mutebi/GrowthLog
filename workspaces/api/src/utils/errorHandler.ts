import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Static } from '@sinclair/typebox';
import type { BadRequest, InternalServerError, RateLimited } from '../typebox/responses.js';

interface Error {
  statusCode?: number;
  message: string;
}

export function errorHandler(error: Error, req: FastifyRequest, res: FastifyReply) {
  const status = error.statusCode ?? 500;

  switch (status) {
    case 400:
      return res.status(400).send({
        error: 'BadRequest',
        message: error.message,
      } satisfies Static<typeof BadRequest>);

    case 429:
      return res.status(429).send({
        error: 'RateLimited',
        message: error.message,
      } satisfies Static<typeof RateLimited>);

    case 500:
      req.log.error(error);
      return res.status(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      } satisfies Static<typeof InternalServerError>);     
    
  
    default:
      return res.status(status).send({
        error: 'ClientError',
        message: error.message,
      });
  }
}
