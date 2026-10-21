import fp from 'fastify-plugin';

export default fp(async (app) => {
  app.addHook('preHandler', async (req, res) => {
    try {
      await req.jwtVerify();
    } catch {
      return res.code(401).send({
        error: 'Unauthorized',
        message: 'This JWT is invalid or expired or malformed',
      });
    }
  });
});
