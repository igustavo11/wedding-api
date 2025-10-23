import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { guestsService } from '../services/guests';

const MAX_UPLOAD_SIZE = 3 * 1024 * 1024; // 3 MB

async function checkUploadSize(request: FastifyRequest, reply: FastifyReply) {
  const len = request.headers['content-length'];
  if (len) {
    const size = Number(len);
    if (!Number.isNaN(size) && size > MAX_UPLOAD_SIZE) {
      return reply.code(413).send({ error: 'File too large', message: 'CSV must be <= 3MB' });
    }
  }
}

export async function guestsRoutes(app: FastifyInstance) {
  // Import CSV
  app.post(
    '/guests/import',
    {
      preHandler: [authMiddleware, checkUploadSize],
      schema: {
        tags: ['guests'],
        description: 'CSV format: name,phone,age_group',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({ error: 'CSV file is required' });
        }

        const result = await guestsService.importFromCSV(data);
        return reply.code(201).send(result);
      } catch (error: unknown) {
        // If the client didn't set Content-Length we still may receive a stream error
        const errObj = error as { message?: unknown };
        const message = errObj && typeof errObj.message === 'string' ? errObj.message : '';
        if (
          message.toLowerCase().includes('max') ||
          message.toLowerCase().includes('size') ||
          message.toLowerCase().includes('too large')
        ) {
          return reply.code(413).send({ error: 'File too large', message: 'CSV must be <= 3MB' });
        }

        request.log.error(error);
        return reply.code(400).send({ error: 'Invalid CSV format' });
      }
    }
  );

  // Search family
  app.get(
    '/guests/family/:phone',
    {
      schema: {
        tags: ['guests'],
        description: 'CSV format: name,phone,age_group',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { phone } = request.params as { phone: string };
        const family = await guestsService.getFamilyByPhone(phone);

        if (!family.total) {
          return reply.code(404).send({ error: 'No guests found with this phone number' });
        }

        return reply.send(family);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Confirm guests
  app.post(
    '/guests/confirm',
    {
      schema: {
        tags: ['guests'],
        description: 'Confirmar/desconfirmar presença de membros da família',
        body: {
          type: 'object',
          required: ['phone', 'confirmations'],
          properties: {
            phone: { type: 'string', description: 'Telefone da família' },
            confirmations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  confirmed: { type: 'boolean' },
                },
              },
              description: 'Lista: [{id: 1, confirmed: true}, ...]',
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const schema = z.object({
          phone: z.string().min(10),
          confirmations: z.array(
            z.object({
              id: z.number(),
              confirmed: z.boolean(),
            })
          ),
        });

        const { phone, confirmations } = schema.parse(request.body);
        const result = await guestsService.confirmByPhone(phone, confirmations);

        if (!result) {
          return reply.code(404).send({ error: 'No guests found with this phone number' });
        }

        return reply.send(result);
      } catch (error) {
        console.error(error);
        return reply.code(400).send({ error: 'Invalid request data' });
      }
    }
  );
  // Get guests by status (confirmed or unconfirmed)
  app.get(
    '/guests/:status',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['guests'],
        description: 'Obter convidados por status (confirmed/unconfirmed)',
        params: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['confirmed', 'unconfirmed'],
              description: 'Status dos convidados',
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status } = request.params as { status: string };

        if (!['confirmed', 'unconfirmed'].includes(status)) {
          return reply.code(400).send({
            error: 'Invalid status',
            message: 'Status deve ser "confirmed" ou "unconfirmed"',
          });
        }

        const confirmed = status === 'confirmed';
        const result = await guestsService.getGuestsByStatus(confirmed);
        return reply.send(result);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get confirmation statistics
  app.get(
    '/guests/stats/overview',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['guests'],
        description: 'Obter estatísticas de confirmação de convidados',
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await guestsService.getConfirmationStats();
        return reply.send(result);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Admin CRUD for guests
  app.post(
    '/guests',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['guests'],
        description: 'Criar convidado manualmente',
        body: {
          type: 'object',
          required: ['name', 'phone', 'ageGroup'],
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            ageGroup: { type: 'string', enum: ['adult', 'child'] },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const schema = z.object({
          name: z.string().min(1),
          phone: z.string().min(1),
          ageGroup: z.enum(['adult', 'child']),
        });

        const payload = schema.parse(request.body);
        const created = await guestsService.createGuest(payload);
        return reply.code(201).send(created);
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({ error: 'Invalid data' });
      }
    }
  );

  app.patch(
    '/guests/:id',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['guests'],
        description: 'Atualizar convidado',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const schema = z.object({
          name: z.string().min(1).optional(),
          phone: z.string().min(1).optional(),
          ageGroup: z.enum(['adult', 'child']).optional(),
          confirmed: z.boolean().optional(),
        });

        const { id } = request.params as { id: number };
        const payload = schema.parse(request.body);
        const updated = await guestsService.updateGuest(Number(id), payload);
        if (!updated) return reply.code(404).send({ error: 'Guest not found' });
        return reply.send(updated);
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({ error: 'Invalid data' });
      }
    }
  );

  app.delete(
    '/guests/:id',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['guests'],
        description: 'Deletar convidado',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: number };
        const deleted = await guestsService.deleteGuest(Number(id));
        if (!deleted) return reply.code(404).send({ error: 'Guest not found' });
        return reply.send({ message: 'Guest deleted', id: deleted.id });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // List all guests (admin) with optional pagination
  app.get(
    '/guests',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['guests'],
        description: 'List all guests (admin) with pagination',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const q = request.query as Record<string, unknown>;
        const page = Number(q.page as unknown as number) || 1;
        const limit = Number(q.limit as unknown as number) || 100;
        const result = await guestsService.listGuests(page, limit);
        return reply.send(result);
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}
