import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guestsService } from '../services/guests';

export async function guestsRoutes(app: FastifyInstance) {
  //import csv
  app.post('/guests/import', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ message: 'No file uploaded' });
      }

      const result = await guestsService.importFromCSV(data);
      return reply.status(201).send(result);
    } catch (error) {
      console.error(error);
      return reply.code(400).send({ message: 'Error importing guests' });
    }
  });

  //search family
  app.get('/guests/family/:phone', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { phone } = request.params as { phone: string };
      const family = await guestsService.getFamilyByPhone(phone);

      if (!family.total) {
        return reply.status(404).send({ message: 'No guests found for this phone number' });
      }
      return reply.status(200).send(family);
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ message: 'Internal server error' });
    }
  });

  // confirm guests
  app.post('/guests/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
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
  });
}
