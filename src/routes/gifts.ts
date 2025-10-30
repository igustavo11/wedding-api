import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { uploadStream } from '../lib/cloudinary';
import { authMiddleware } from '../middlewares/auth';
import { giftsService } from '../services/gifts';

export async function giftsRoutes(app: FastifyInstance) {
  // Public list
  app.get('/gifts', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, unknown>;
    const page = Number(q.page as unknown as number) || 1;
    const limit = Number(q.limit as unknown as number) || 50;
    const result = await giftsService.list(page, limit);
    return reply.send(result);
  });

  // Public get by id
  app.get('/gifts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: number };
    const item = await giftsService.getById(Number(id));
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return reply.send(item);
  });

  // Admin create (multipart with file)
  app.post(
    '/gifts',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const file = await request.file().catch(() => null);

        // Extract fields from multipart (they come in file.fields when using multipart)
        const fields = file?.fields || ({} as Record<string, { value: string }>);

        // Debug: log what we're receiving
        request.log.info({ fields, fileExists: !!file }, 'Multipart fields received');

        const getValue = (key: string) => {
          // Try with exact key first, then with trimmed variations
          let val = fields[key];
          if (!val) {
            // Try to find by trimming spaces in field names
            const found = Object.entries(fields).find(([k]) => k.trim() === key);
            val = found?.[1];
          }
          return val && typeof val === 'object' && 'value' in val ? val.value : val;
        };

        let imageUrl: string | undefined;
        if (file) {
          const filename = file.filename || 'unknown';
          request.log.info({ filename }, 'Starting upload to Cloudinary');
          try {
            const buffer = await file.toBuffer();
            const res = await uploadStream(buffer, 'gifts');
            imageUrl = res.secure_url;
            request.log.info({ secure_url: imageUrl }, 'Upload to Cloudinary successful');
          } catch (err) {
            request.log.error({ err }, 'Cloudinary upload failed');
            const msg = err instanceof Error ? err.message : String(err);
            return reply.code(500).send({ error: 'Upload failed', detail: msg });
          }
        }

        const schema = z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          price: z.string().min(1),
          available: z.coerce.boolean().optional(),
        });

        const payload = schema.parse({
          name: getValue('name'),
          description: getValue('description') || undefined,
          price: getValue('price'),
          available: getValue('available') || undefined,
        });
        const created = await giftsService.create({ ...payload, imageUrl });
        return reply.code(201).send(created);
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({ error: 'Invalid data or upload failed' });
      }
    }
  );

  // Admin update
  app.patch(
    '/gifts/:id',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: number };
        const file = await request.file().catch(() => null);

        // If no file, data comes from request.body (multipart without file)
        // If file exists, data comes from file.fields
        let dataSource: Record<string, unknown>;

        if (file?.fields && Object.keys(file.fields).length > 0) {
          // Has file with fields - extract from file.fields
          const fields = file.fields;
          request.log.info({ fields, fileExists: true }, 'Multipart with file');

          const getValue = (key: string) => {
            let val = fields[key];
            if (!val) {
              const found = Object.entries(fields).find(([k]) => k.trim() === key);
              val = found?.[1];
            }
            return val && typeof val === 'object' && 'value' in val ? val.value : val;
          };

          dataSource = {
            name: getValue('name'),
            description: getValue('description'),
            price: getValue('price'),
            available: getValue('available'),
          };
        } else {
          // No file or multipart without file - use request.body
          dataSource = (request.body as Record<string, unknown>) || {};
          request.log.info(
            { body: dataSource, fileExists: !!file },
            'Multipart without file or JSON body'
          );
        }

        let imageUrl: string | undefined;
        if (file) {
          const filename = file.filename || 'unknown';
          request.log.info({ filename }, 'Starting upload to Cloudinary (update)');
          try {
            const buffer = await file.toBuffer();
            const res = await uploadStream(buffer, 'gifts');
            imageUrl = res.secure_url;
            request.log.info({ secure_url: imageUrl }, 'Upload to Cloudinary successful (update)');
          } catch (err) {
            request.log.error({ err }, 'Cloudinary upload failed (update)');
            const msg = err instanceof Error ? err.message : String(err);
            return reply.code(500).send({ error: 'Upload failed', detail: msg });
          }
        }

        const schema = z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          price: z.string().optional(),
          available: z.coerce.boolean().optional(),
        });

        const payload = schema.parse({
          name: dataSource.name || undefined,
          description: dataSource.description || undefined,
          price: dataSource.price || undefined,
          available: dataSource.available !== undefined ? dataSource.available : undefined,
        });
        const updated = await giftsService.update(Number(id), {
          ...payload,
          ...(imageUrl ? { imageUrl } : {}),
        });
        if (!updated) return reply.code(404).send({ error: 'Not found' });
        return reply.send(updated);
      } catch (error) {
        request.log.error(error);
        const message = error instanceof Error ? error.message : 'Invalid data or upload failed';
        const statusCode = message.includes('Nenhum campo') ? 400 : 400;
        return reply.code(statusCode).send({ error: message });
      }
    }
  );

  // Admin delete
  app.delete(
    '/gifts/:id',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: number };
        const deleted = await giftsService.delete(Number(id));
        if (!deleted) return reply.code(404).send({ error: 'Not found' });
        return reply.send({ message: 'Deleted', id: deleted.id });
      } catch (error) {
        request.log.error(error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        // Se for erro de foreign key constraint, retornar 400 com mensagem explicativa
        const statusCode = message.includes('compras associadas') ? 400 : 500;
        return reply.code(statusCode).send({ error: message });
      }
    }
  );
}
