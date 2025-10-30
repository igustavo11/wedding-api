import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { paymentsService } from '../services/payments';

export async function paymentsRoutes(app: FastifyInstance) {
  const createPaymentHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        giftId: z.number().int().positive(),
        buyerName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
        buyerPhone: z.string().min(10, 'Telefone inválido'),
        buyerEmail: z.string().email('Email inválido'),
        buyerTaxId: z
          .string()
          .transform((val) => val.replace(/\D/g, ''))
          .refine((val) => val.length === 11 || val.length === 14, {
            message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos',
          }),
        guestId: z.number().int().positive().optional(),
        binaryMode: z.boolean().optional(),
        address: z
          .object({
            street: z.string().optional(),
            number: z.string().optional(),
            zipCode: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
          })
          .optional(),
      });

      const data = schema.parse(request.body);

      const result = await paymentsService.createPayment(data);

      return reply.code(201).send({
        success: true,
        data: {
          purchaseId: result.purchase?.id,
          giftId: result.gift.id,
          giftName: result.gift.name,
          amount: Number.parseFloat(result.gift.price),
          checkoutUrl: result.checkoutUrl,
          preferenceId: result.preferenceId,
          availablePaymentMethods: result.availablePaymentMethods,
        },
      });
    } catch (error) {
      request.log.error(error);
      const message = error instanceof Error ? error.message : 'Erro ao criar pagamento';
      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  };

  app.post('/payments/create', createPaymentHandler);
  app.post('/payments/pix/create', createPaymentHandler);

  app.get('/payments/:purchaseId/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { purchaseId } = request.params as { purchaseId: string };

      await paymentsService.checkPaymentStatus(Number(purchaseId));

      const purchaseWithGift = await paymentsService.getPurchaseById(Number(purchaseId));

      if (!purchaseWithGift) {
        return reply.code(404).send({
          success: false,
          error: 'Compra não encontrada',
        });
      }

      return reply.send({
        success: true,
        data: {
          purchaseId: purchaseWithGift.id,
          status: purchaseWithGift.paymentStatus,
          expiresAt: purchaseWithGift.expiresAt,
          gift: {
            id: purchaseWithGift.gift?.id,
            name: purchaseWithGift.gift?.name,
            price: purchaseWithGift.gift?.price,
          },
          updatedAt: purchaseWithGift.updatedAt,
        },
      });
    } catch (error) {
      request.log.error(error);
      const message = error instanceof Error ? error.message : 'Erro ao verificar status';
      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });

  app.post('/payments/:purchaseId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { purchaseId } = request.params as { purchaseId: string };
      await paymentsService.cancelPayment(Number(purchaseId));

      return reply.send({
        success: true,
        message: 'Pagamento cancelado com sucesso',
        purchaseId: Number(purchaseId),
      });
    } catch (error) {
      request.log.error(error);
      const message = error instanceof Error ? error.message : 'Erro ao cancelar pagamento';
      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });

  app.get(
    '/payments/purchases',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const purchases = await paymentsService.listPurchases();

        return reply.send({
          success: true,
          data: purchases,
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Erro ao listar compras',
        });
      }
    }
  );

  app.get(
    '/payments/purchases/:purchaseId',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { purchaseId } = request.params as { purchaseId: string };

        const purchase = await paymentsService.getPurchaseById(Number(purchaseId));

        if (!purchase) {
          return reply.code(404).send({
            success: false,
            error: 'Compra não encontrada',
          });
        }

        return reply.send({
          success: true,
          data: purchase,
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Erro ao buscar compra',
        });
      }
    }
  );

  app.post(
    '/payments/webhook/mercadopago',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { topic?: string; id?: string };
        const body = request.body as { type?: string; data?: { id: string } } | null;

        request.log.info({ query, body }, 'Webhook recebido do Mercado Pago');

        if (query.topic && query.id) {
          if (query.topic === 'payment' || query.topic === 'merchant_order') {
            const result = await paymentsService.processMercadoPagoWebhook({
              type: query.topic,
              data: { id: query.id },
            });

            if (result) {
              request.log.info(
                { purchaseId: result.purchaseId, status: result.status },
                'Notificação processada via webhook'
              );
            } else {
              request.log.info(
                { topic: query.topic, id: query.id },
                'Notificação recebida mas não processada'
              );
            }
          }
        }

        if (body?.type && body.data?.id) {
          const result = await paymentsService.processMercadoPagoWebhook({
            type: body.type,
            data: body.data,
          });

          if (result) {
            request.log.info(
              { purchaseId: result.purchaseId, status: result.status },
              'Pagamento processado via webhook'
            );
          }
        }

        return reply.send({ success: true });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Erro ao processar webhook' });
      }
    }
  );

  app.get('/payments/webhook/mercadopago', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { topic?: string; id?: string };

      request.log.info({ query }, 'Webhook GET recebido do Mercado Pago');

      if (query.topic === 'payment' || query.topic === 'merchant_order') {
        if (query.id) {
          const result = await paymentsService.processMercadoPagoWebhook({
            type: query.topic,
            data: { id: query.id },
          });

          if (result) {
            request.log.info(
              { purchaseId: result.purchaseId, status: result.status },
              'Notificação processada via webhook GET'
            );
          } else {
            request.log.info(
              { topic: query.topic, id: query.id },
              'Notificação recebida mas não processada'
            );
          }
        }
      }

      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Erro ao processar webhook' });
    }
  });
}
