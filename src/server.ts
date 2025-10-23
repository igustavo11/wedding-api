import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { env } from './config/env';
import { routes } from './routes';
import { setupSwagger } from './swagger/swagger';

const app = Fastify({ logger: true });
await setupSwagger(app);

app.register(cookie, {
  secret: env.BETTER_AUTH_SECRET,
});

app.register(cors, {
  origin: env.BETTER_AUTH_URL || 'http://localhost:3338',
  credentials: true,
});

app.register(multipart, {
  limits: {
    fileSize: 3 * 1024 * 1024, // 3 MB
  },
});

app.register(routes);

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

app.listen({ port: env.PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(` Server running at ${address}`);
});
