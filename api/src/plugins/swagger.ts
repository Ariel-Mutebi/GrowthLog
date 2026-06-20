import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';

export const swaggerPlugin = fp(async (app) => {
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'GrowthLog API',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          session: {
            type: 'apiKey',
            in: 'cookie',
            name: 'sessionId',
          },
        },
      },
    },
  });

  if (process.env.NODE_ENV === 'dev') {
    const { default: fastifySwaggerUi } = await import('@fastify/swagger-ui');
    app.register(fastifySwaggerUi, { routePrefix: '/v1/docs' });
  }
});
