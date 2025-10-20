import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { guestsRoutes } from './guests';

export async function routes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: '/api' });
  app.register(guestsRoutes, { prefix: '/api' });
}
