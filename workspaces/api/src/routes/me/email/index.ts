import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn } from '../../../auth/preHandler.js';
import { ConfirmSchema, RequestSchema } from './schema.js';
import { EmailVerificationService, InvalidCode } from '../../../services/EmailVerificationService.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new EmailVerificationService(app.prisma, app.emailer);

  app.post('/request-verification', {
    schema: RequestSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.issueCode(req.user.id);
    return res.code(204).send(null);
  });

  app.post('/confirm-token', {
    schema: ConfirmSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await service.verifyEmail(req.user.id, req.body.code);
      return res.code(204).send(null);
    } catch (error) {
      if (error instanceof InvalidCode) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'Invalid or expired verification code',
        });
      }

      throw error;
    }
  });
};

export default router;
