import { buildApp } from './app.js';

const app = buildApp();

const shutdown = async () => {
  try {
    await app.close();
  } catch (error) {
    app.log.error(error);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  await app.listen({ port: app.config.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
}
