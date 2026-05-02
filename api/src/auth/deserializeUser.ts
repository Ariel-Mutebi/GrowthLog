import type { PassportUser } from 'fastify';

export const deserializeUser = async (serializedUser: PassportUser) => serializedUser;
