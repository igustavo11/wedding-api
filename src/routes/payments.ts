import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env';
import { authMiddleware } from '../middlewares/auth';
import { paymentsService } from '../services/payments';

export async function paymentsRoutes(app: FastifyInstance) {
  app.post('/payments/pix/create', async (request: FastifyRequest, reply: FastifyReply) => {
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
      });

      const data = schema.parse(request.body);

      const result = await paymentsService.createPixPayment(data);

      return reply.code(201).send({
        success: true,
        data: {
          purchaseId: result.purchase?.id,
          giftId: result.gift.id,
          giftName: result.gift.name,
          amount: Number.parseFloat(result.gift.price),
          pixQrCode: result.pixData.qrCode,
          pixQrCodeBase64: result.pixData.qrCodeBase64,
          expiresAt: result.pixData.expiresAt,
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
  });

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

  app.post(
    '/payments/:purchaseId/simulate-payment',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { purchaseId } = request.params as { purchaseId: string };

        const result = await paymentsService.simulatePayment(Number(purchaseId));

        return reply.send({
          success: true,
          message: result.message,
          purchaseId: Number(purchaseId),
        });
      } catch (error) {
        request.log.error(error);
        const message = error instanceof Error ? error.message : 'Erro ao simular pagamento';
        return reply.code(400).send({
          success: false,
          error: message,
        });
      }
    }
  );

  app.post(
    '/payments/:purchaseId/simulate-payment-dev',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Verificar se está em Dev Mode
        if (!env.ABACATEPAY_DEV_MODE) {
          return reply.code(403).send({
            success: false,
            error: 'Este endpoint só está disponível em Dev Mode',
          });
        }

        const { purchaseId } = request.params as { purchaseId: string };

        const result = await paymentsService.simulatePayment(Number(purchaseId));

        return reply.send({
          success: true,
          message: result.message,
          purchaseId: Number(purchaseId),
        });
      } catch (error) {
        request.log.error(error);
        const message = error instanceof Error ? error.message : 'Erro ao simular pagamento';
        return reply.code(400).send({
          success: false,
          error: message,
        });
      }
    }
  );

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

  app.post('/payments/webhook/abacatepay', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        event: string;
        data: {
          id: string;
          status: string;
        };
      };

      request.log.info({ webhook: body }, 'Webhook recebido da AbacatePay');

      const purchases = await paymentsService.listPurchases();
      const purchase = purchases.find((p) => p.pixChargeId === body.data.id);

      if (!purchase) {
        request.log.warn({ pixChargeId: body.data.id }, 'Compra não encontrada para webhook');
        return reply.code(404).send({ error: 'Compra não encontrada' });
      }

      if (body.event === 'pix.paid' && body.data.status === 'PAID') {
        await paymentsService.handlePaymentSuccess(purchase.id);
        request.log.info({ purchaseId: purchase.id }, 'Pagamento processado via webhook');
      } else if (body.event === 'pix.expired' && body.data.status === 'EXPIRED') {
        await paymentsService.handlePaymentExpired(purchase.id);
        request.log.info({ purchaseId: purchase.id }, 'Expiração processada via webhook');
      }

      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Erro ao processar webhook' });
    }
  });
}
