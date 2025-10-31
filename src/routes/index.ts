import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { giftsRoutes } from './gifts';
import { guestsRoutes } from './guests';
import { memoriesRoutes } from './memories';
import { paymentsRoutes } from './payments';

export async function routes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: '/api' });
  app.register(guestsRoutes, { prefix: '/api' });
  app.register(giftsRoutes, { prefix: '/api' });
  app.register(memoriesRoutes, { prefix: '/api' });
  app.register(paymentsRoutes, { prefix: '/api' });
}
