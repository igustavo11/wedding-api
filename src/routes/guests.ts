import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guestsService } from '../services/guests';

export async function guestsRoutes(app: FastifyInstance) {
  // Import CSV
  app.post(
    '/guests/import',
    {
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
      } catch (error) {
        console.error(error);
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
        body: {
          type: 'object',
          properties: {
            guestIds: { type: 'array', items: { type: 'number' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const schema = z.object({
          guestIds: z.array(z.number()).min(1),
        });

        const { guestIds } = schema.parse(request.body);
        const result = await guestsService.confirmGuests(guestIds);

        return reply.send(result);
      } catch (error) {
        console.error(error);
        return reply.code(400).send({ error: 'Invalid request data' });
      }
    }
  );
}
