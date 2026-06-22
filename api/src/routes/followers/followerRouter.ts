import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { FollowSomeone } from './followerSchemas.js';
import { isLoggedIn } from '../../auth/preHandler.js';

const followerRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.put('/:userId', {
    schema: FollowSomeone,
    preHandler: isLoggedIn,
  }, (req, res) => {});
};

export default followerRouter;
