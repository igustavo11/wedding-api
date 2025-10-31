import { stringify } from 'csv-stringify/sync';
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
        request.log.info({ phone }, 'Searching for family by phone');

        const family = await guestsService.getFamilyByPhone(phone);
        request.log.info({ phone, total: family.total }, 'Family search result');

        if (!family || !family.total || family.total === 0) {
          request.log.warn({ phone }, 'No guests found with this phone number');
          return reply.code(404).send({ error: 'No guests found with this phone number' });
        }

        return reply.send(family);
      } catch (error) {
        request.log.error({ error }, 'Error searching family');
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

  // Update attendance status (new method - accepts pending, confirmed, declined)
  app.post(
    '/guests/attendance',
    {
      schema: {
        tags: ['guests'],
        description: 'Atualizar status de presença (pending, confirmed, declined)',
        body: {
          type: 'object',
          required: ['phone', 'attendanceUpdates'],
          properties: {
            phone: { type: 'string', description: 'Telefone da família' },
            attendanceUpdates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  attendanceStatus: {
                    type: 'string',
                    enum: ['pending', 'confirmed', 'declined'],
                  },
                },
              },
              description: 'Lista: [{id: 1, attendanceStatus: "confirmed"}, ...]',
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const schema = z.object({
          phone: z.string().min(10),
          attendanceUpdates: z.array(
            z.object({
              id: z.number(),
              attendanceStatus: z.enum(['pending', 'confirmed', 'declined']),
            })
          ),
        });

        const { phone, attendanceUpdates } = schema.parse(request.body);
        const result = await guestsService.updateAttendanceStatus(phone, attendanceUpdates);

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

  // Get guests by attendance status (pending, confirmed, declined)
  app.get(
    '/guests/attendance/:status',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['guests'],
        description: 'Obter convidados por status de presença (pending/confirmed/declined)',
        params: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'declined'],
              description: 'Status de presença dos convidados',
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status } = request.params as { status: string };

        if (!['pending', 'confirmed', 'declined'].includes(status)) {
          return reply.code(400).send({
            error: 'Invalid status',
            message: 'Status deve ser "pending", "confirmed" ou "declined"',
          });
        }

        const result = await guestsService.getGuestsByAttendanceStatus(
          status as 'pending' | 'confirmed' | 'declined'
        );
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
          attendanceStatus: z.enum(['pending', 'confirmed', 'declined']).optional(),
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
        request.log.info({ guestId: id }, 'Attempting to delete guest');

        const deleted = await guestsService.deleteGuest(Number(id));

        if (!deleted) {
          request.log.warn({ guestId: id }, 'Guest not found');
          return reply.code(404).send({ error: 'Guest not found' });
        }

        request.log.info({ guestId: id, deletedId: deleted.id }, 'Guest deleted successfully');
        return reply.send({ message: 'Guest deleted', id: deleted.id });
      } catch (error) {
        request.log.error({ error }, 'Error deleting guest');
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
        const limit = Number(q.limit as unknown as number) || 500;
        const result = await guestsService.listGuests(page, limit);
        return reply.send(result);
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Export CSV (admin only)
  app.get(
    '/guests/export',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const allGuests = await guestsService.listGuests(1, 100000);

        const records = allGuests.guests.map((guest) => ({
          nome: guest.name,
          telefone: guest.phone,
          faixa_etaria: guest.ageGroup === 'adult' ? 'adulto' : 'crianca',
          confirmado: guest.confirmed ? 'sim' : 'nao',
        }));

        const csv = stringify(records, {
          header: true,
          columns: ['nome', 'telefone', 'faixa_etaria', 'confirmado'],
        });

        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="convidados.csv"')
          .send(csv);
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Admin delete all guests
  app.delete(
    '/guests/all',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['guests'],
        description: 'Deletar TODOS os convidados (cuidado!)',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        request.log.warn('Deleting ALL guests - this is a destructive operation');

        const allGuests = await guestsService.listGuests(1, 100000);
        const totalDeleted = allGuests.guests.length;

        for (const guest of allGuests.guests) {
          await guestsService.deleteGuest(guest.id);
        }

        request.log.info({ totalDeleted }, 'All guests deleted successfully');
        return reply.send({
          message: 'All guests deleted',
          totalDeleted,
        });
      } catch (error) {
        request.log.error({ error }, 'Error deleting all guests');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}
