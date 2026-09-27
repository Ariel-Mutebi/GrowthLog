import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';

export const swaggerPlugin = fp(async (app) => {
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'GrowthLog Images',
        version: '1.0.0',
      },

      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },

      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });
});
