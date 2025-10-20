import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth";
import { guestsService } from "../services/guests";

export async function guestsRoutes(app: FastifyInstance) {
  // Import CSV
  app.post(
    "/guests/import",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["guests"],
        description: "CSV format: name,phone,age_group",
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({ error: "CSV file is required" });
        }

        const result = await guestsService.importFromCSV(data);
        return reply.code(201).send(result);
      } catch (error) {
        console.error(error);
        return reply.code(400).send({ error: "Invalid CSV format" });
      }
    },
  );

  // Search family
  app.get(
    "/guests/family/:phone",
    {
      schema: {
        tags: ["guests"],
        description: "CSV format: name,phone,age_group",
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { phone } = request.params as { phone: string };
        const family = await guestsService.getFamilyByPhone(phone);

        if (!family.total) {
          return reply
            .code(404)
            .send({ error: "No guests found with this phone number" });
        }

        return reply.send(family);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  // Confirm guests
  app.post(
    "/guests/confirm",
    {
      schema: {
        tags: ["guests"],
        description: "Confirmar/desconfirmar presença de membros da família",
        body: {
          type: "object",
          required: ["phone", "confirmations"],
          properties: {
            phone: { type: "string", description: "Telefone da família" },
            confirmations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  confirmed: { type: "boolean" },
                },
              },
              description: "Lista: [{id: 1, confirmed: true}, ...]",
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
            }),
          ),
        });

        const { phone, confirmations } = schema.parse(request.body);
        const result = await guestsService.confirmByPhone(phone, confirmations);

        if (!result) {
          return reply
            .code(404)
            .send({ error: "No guests found with this phone number" });
        }

        return reply.send(result);
      } catch (error) {
        console.error(error);
        return reply.code(400).send({ error: "Invalid request data" });
      }
    },
  );
  // Get guests by status (confirmed or unconfirmed)
  app.get(
    "/guests/:status",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["guests"],
        description: "Obter convidados por status (confirmed/unconfirmed)",
        params: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["confirmed", "unconfirmed"],
              description: "Status dos convidados",
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status } = request.params as { status: string };

        if (!["confirmed", "unconfirmed"].includes(status)) {
          return reply.code(400).send({
            error: "Invalid status",
            message: 'Status deve ser "confirmed" ou "unconfirmed"',
          });
        }

        const confirmed = status === "confirmed";
        const result = await guestsService.getGuestsByStatus(confirmed);
        return reply.send(result);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  // Get confirmation statistics
  app.get(
    "/guests/stats/overview",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["guests"],
        description: "Obter estatísticas de confirmação de convidados",
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await guestsService.getConfirmationStats();
        return reply.send(result);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
