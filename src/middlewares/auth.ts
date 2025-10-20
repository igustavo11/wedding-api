import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { session, user } from "../db/schema";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    // Read token from cookie instead of Authorization header
    const token = request.cookies["better-auth.session_token"];

    if (!token) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    // Validate session by querying the database
    const sessionData = await db
      .select({
        session: session,
        user: user,
      })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(eq(session.token, token))
      .limit(1);

    if (!sessionData || sessionData.length === 0) {
      return reply.status(401).send({ message: "Invalid token" });
    }

    const { session: userSession, user: userData } = sessionData[0]!;

    // Check if session is expired
    if (new Date(userSession.expiresAt) < new Date()) {
      return reply.status(401).send({ message: "Session expired" });
    }

    // Attach user and session to request
    request.user = userData;
    request.session = userSession;
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return reply.status(401).send({ message: "Unauthorized" });
  }
}
