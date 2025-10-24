import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { uploadStream } from '../lib/cloudinary';
import { memoriesService } from '../services/memories';

export async function memoriesRoutes(app: FastifyInstance) {
  // Public list all memories
  app.get('/memories', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await memoriesService.list();
    return reply.send(result);
  });

  // Public upload memory (photo)
  app.post('/memories', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const file = await request.file();

      if (!file) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Upload to Cloudinary
      const filename = file.filename || 'memory';
      request.log.info({ filename }, 'Uploading memory to Cloudinary');

      const buffer = await file.toBuffer();
      const cloudinaryResult = await uploadStream(buffer);

      // Extract description from fields if provided
      const fields = file.fields || {};
      const getFieldValue = (key: string): string | undefined => {
        const val = fields[key];
        return val && typeof val === 'object' && 'value' in val ? String(val.value) : undefined;
      };

      const description = getFieldValue('description');

      // Save to database
      const memory = await memoriesService.create({
        url: cloudinaryResult.secure_url,
        description,
      });

      if (!memory) {
        return reply.code(500).send({ error: 'Failed to save memory to database' });
      }

      request.log.info({ memoryId: memory.id, url: memory.url }, 'Memory uploaded successfully');
      return reply.code(201).send(memory);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to upload memory' });
    }
  });
}
