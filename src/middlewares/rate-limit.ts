import type { FastifyReply, FastifyRequest } from "fastify";

const loginAttempts = new Map<string, { count: number; resetTime: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

setInterval(
  () => {
    const now = Date.now();
    for (const [ip, data] of loginAttempts.entries()) {
      if (now > data.resetTime) {
        loginAttempts.delete(ip);
      }
    }
  },
  30 * 60 * 1000,
);

export async function rateLimitAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const ip = request.ip;
  const now = Date.now();

  let attempt = loginAttempts.get(ip);

  if (!attempt || now > attempt.resetTime) {
    attempt = { count: 1, resetTime: now + WINDOW_MS };
    loginAttempts.set(ip, attempt);
    return;
  }

  if (attempt.count >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((attempt.resetTime - now) / 1000 / 60);
    return reply.status(429).send({
      error: "Too many attempts",
      message: `Muitas tentativas de login. Tente novamente em ${remainingTime} minutos.`,
      retryAfter: remainingTime,
    });
  }

  attempt.count++;
}
