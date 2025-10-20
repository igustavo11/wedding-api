import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '../lib/auth';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');

    //validate session

    const session = await auth.api.getSession({
      headers: {
        cookie: `better-auth.session_token=${token}`,
      },
    });

    if (!session || !session.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    //attach user to request
    request.user = session.user;
    request.session = session.session;
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return reply.status(401).send({ message: 'Unauthorized' });
  }
}
