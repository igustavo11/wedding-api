import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '../lib/auth';
import { authMiddleware } from '../middlewares/auth';

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/signup',
    {
      schema: {
        tags: ['auth'],
        description: 'Registrar novo administrador',
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, password, name } = request.body as {
          email: string;
          password: string;
          name: string;
        };

        const result = await auth.api.signUpEmail({
          body: {
            email,
            password,
            name,
          },
        });

        return reply.code(201).send(result);
      } catch (error) {
        console.error('Signup error:', error);
        return reply.code(400).send({ error: 'Failed to create admin account' });
      }
    }
  );

  // Login
  app.post(
    '/auth/signin',
    {
      schema: {
        tags: ['auth'],
        description: 'Login de administrador',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, password } = request.body as {
          email: string;
          password: string;
        };

        const result = await auth.api.signInEmail({
          body: {
            email,
            password,
          },
        });

        return reply.send(result);
      } catch (error) {
        console.error('Signin error:', error);
        return reply.code(401).send({ error: 'Invalid credentials' });
      }
    }
  );

  // Logout
  app.post(
    '/auth/signout',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['auth'],
        description: 'Logout do administrador',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '') || '';

        await auth.api.signOut({
          headers: {
            cookie: `better-auth.session_token=${token}`,
          },
        });

        return reply.send({ message: 'Logged out successfully' });
      } catch (error) {
        console.error('Signout error:', error);
        return reply.code(500).send({ error: 'Failed to logout' });
      }
    }
  );

  app.get(
    '/auth/me',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['auth'],
        description: 'Obter dados do administrador logado',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        user: request.user,
        session: request.session,
      });
    }
  );
}
