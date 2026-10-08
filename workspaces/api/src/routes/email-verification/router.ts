import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { EmailVerificationService, InvalidCode } from './service.js';
import { ConfirmSchema, RequestSchema } from './schema.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new EmailVerificationService(app.prisma);

  app.post('/request', {
    preHandler: isLoggedIn,
    schema: RequestSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const userId = req.user.id;
    const code = service.generateCode();

    try {
      await service.issueCode(userId, code);
      await app.emailer.sendVerificationEmail({ userId, code });
      return res.code(204).send(null);
    } catch (error) {
      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.post('/confirm', {
    preHandler: isLoggedIn,
    schema: ConfirmSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const userId = req.user.id;

    try {
      const codeId = await service.getCodeId(userId, req.body.code);
      await service.verifyEmail(userId, codeId);
      return res.code(204).send(null);
    } catch (error) {
      if (error instanceof InvalidCode) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'Invalid or expired verification code',
        });
      }

      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });
};

export default router;
