import fp from 'fastify-plugin';

export const authPlugin = fp((app) => {
  app.decorateRequest('jwt', {
    getter() {
      throw new Error('req.jwt accessed before verifyJWT ran');
    },
  });
});
