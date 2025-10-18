import type { FastifyInstance } from 'fastify';
import { guestsRoutes } from './guests';

export async function routes(app: FastifyInstance) {
  app.register(guestsRoutes, { prefix: '/api' });
}
