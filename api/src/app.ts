import Fastify from 'fastify';
import sensible from './plugins/sensible.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(sensible);

  return app;
}
