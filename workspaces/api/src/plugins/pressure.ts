import underPressure from '@fastify/under-pressure';
import type { FastifyPluginAsync } from 'fastify';

const MIB = 1024 * 1024;

export const underPressurePlugin: FastifyPluginAsync = async (app) => {
  app.register(underPressure, {
    maxRssBytes: 200 * MIB,
    maxHeapUsedBytes: 128 * MIB,
    maxEventLoopDelay: 1_000,
    retryAfter: 5,
    message: 'Service temporarily unavailable',
  });
};
