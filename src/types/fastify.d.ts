import 'fastify';
import type { Session } from '../lib/auth';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    session?: Session['session'];
  }
}
