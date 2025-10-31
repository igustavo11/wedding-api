import { eq } from 'drizzle-orm';
import { db } from '../db';
import { gifts, purchases } from '../db/schema';
import { mercadoPagoClient } from '../lib/mercadopago';

interface CreatePaymentParams {
  giftId: number;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerTaxId: string;
  guestId?: number;
  binaryMode?: boolean;
  address?: {
    street?: string;
    number?: string;
    zipCode?: string;
    city?: string;
    state?: string;
  };
}

class PaymentsService {
  private cleanTaxId(taxId: string): string {
    return taxId.replace(/\D/g, '');
  }

  async createPayment(params: CreatePaymentParams) {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error('Mercado Pago não está configurado. Entre em contato com o administrador.');
    }

    const cleanedTaxId = this.cleanTaxId(params.buyerTaxId);

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, params.giftId)).limit(1);

    if (!gift) {
      throw new Error('Presente não encontrado');
    }

    const [existingPurchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.giftId, params.giftId))
      .limit(1);

    if (existingPurchase && existingPurchase.paymentStatus === 'paid') {
      throw new Error('Este presente já foi comprado');
    }

    if (existingPurchase && existingPurchase.paymentStatus === 'pending') {
      if (existingPurchase.expiresAt && new Date(existingPurchase.expiresAt) > new Date()) {
        throw new Error('Já existe um pagamento pendente para este presente');
      }
    }

    if (!gift.available) {
      throw new Error('Presente não está disponível para compra');
    }

    const priceInDecimal = Number.parseFloat(gift.price);

    const paymentResponse = await mercadoPagoClient.createPayment({
      giftId: params.giftId,
      giftName: gift.name,
      amount: priceInDecimal,
      buyerName: params.buyerName,
      buyerEmail: params.buyerEmail,
      buyerPhone: params.buyerPhone,
      buyerTaxId: cleanedTaxId,
      guestId: params.guestId,
      binaryMode: params.binaryMode,
      address: params.address,
    });

    const [purchase] = await db
      .insert(purchases)
      .values({
        giftId: params.giftId,
        guestId: params.guestId || null,
        buyerName: params.buyerName,
        buyerPhone: params.buyerPhone,
        buyerEmail: params.buyerEmail,
        buyerTaxId: cleanedTaxId,
        paymentMethod: 'pix',
        paymentStatus: 'pending',
        paymentId: paymentResponse.preferenceId,
        pixChargeId: null,
        pixQrCode: null,
        pixQrCodeBase64: null,
        expiresAt: null,
        metadata: JSON.stringify({
          platform: 'mercadopago',
          preferenceId: paymentResponse.preferenceId,
          checkoutUrl: paymentResponse.checkoutUrl,
        }),
      })
      .returning();

    return {
      purchase,
      gift,
      checkoutUrl: paymentResponse.checkoutUrl,
      preferenceId: paymentResponse.preferenceId,
      availablePaymentMethods: ['pix', 'credit_card'],
    };
  }

  async checkPaymentStatus(purchaseId: number) {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      throw new Error('Compra não encontrada');
    }

    if (
      purchase.paymentStatus === 'paid' ||
      purchase.paymentStatus === 'expired' ||
      purchase.paymentStatus === 'cancelled' ||
      purchase.paymentStatus === 'failed'
    ) {
      return {
        purchase,
        needsUpdate: false,
      };
    }

    return {
      purchase,
      needsUpdate: false,
    };
  }

  async handlePaymentSuccess(purchaseId: number) {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      throw new Error('Compra não encontrada');
    }

    if (purchase.paymentStatus === 'paid') {
      return;
    }

    await db
      .update(purchases)
      .set({
        paymentStatus: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchaseId));

    await db.update(gifts).set({ available: false }).where(eq(gifts.id, purchase.giftId));
  }

  async handlePaymentExpired(purchaseId: number) {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      throw new Error('Compra não encontrada');
    }

    await db
      .update(purchases)
      .set({
        paymentStatus: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchaseId));

    await db.update(gifts).set({ available: true }).where(eq(gifts.id, purchase.giftId));
  }

  async handlePaymentFailed(purchaseId: number) {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      throw new Error('Compra não encontrada');
    }

    await db
      .update(purchases)
      .set({
        paymentStatus: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchaseId));

    await db.update(gifts).set({ available: true }).where(eq(gifts.id, purchase.giftId));
  }

  async cancelPayment(purchaseId: number) {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      throw new Error('Compra não encontrada');
    }

    if (purchase.paymentStatus !== 'pending') {
      throw new Error('Apenas pagamentos pendentes podem ser cancelados');
    }

    await db
      .update(purchases)
      .set({
        paymentStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchaseId));

    await db.update(gifts).set({ available: true }).where(eq(gifts.id, purchase.giftId));
  }

  async listPurchases(filters?: { status?: string; giftId?: number }) {
    let query = db.select().from(purchases);

    if (filters?.giftId) {
      query = query.where(eq(purchases.giftId, filters.giftId)) as typeof query;
    }

    const result = await query;
    return result;
  }

  async getPurchaseById(purchaseId: number) {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      return null;
    }

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, purchase.giftId)).limit(1);

    return {
      ...purchase,
      gift,
    };
  }

  async processMercadoPagoWebhook(data: {
    type: string;
    data: {
      id: string;
    };
  }) {
    const { type, data: notificationData } = data;

    if (type === 'payment') {
      const paymentId = notificationData.id;

      try {
        let payment;
        try {
          payment = await mercadoPagoClient.getPayment(paymentId);
        } catch (error: any) {
          if (error?.status === 404 || error?.error === 'not_found') {
            try {
              const preference = await mercadoPagoClient.getPreference(paymentId);
              const preferenceId = preference.id || paymentId;

              const purchasesList = await this.listPurchases();
              const purchase = purchasesList.find((p) => p.paymentId === preferenceId);

              if (purchase) {
                return { purchaseId: purchase.id, status: 'notification_received' };
              }

              return null;
            } catch {
              return null;
            }
          }
          throw error;
        }

        // O payment.preference_id contém o ID da preferência criada
        const preferenceId = (payment as any).preference_id;

        if (!preferenceId) {
          // Tentar usar external_reference para encontrar a compra
          const externalReference = (payment as any).external_reference;

          if (externalReference?.includes('gift-')) {
            // external_reference no formato: gift-{giftId}-{preferenceId}-{timestamp}
            const match = externalReference.match(/gift-(\d+)-/);
            if (match) {
              const foundGiftId = Number(match[1]);

              const purchasesList = await this.listPurchases({ giftId: foundGiftId });

              const purchase = purchasesList.find(
                (p) =>
                  p.paymentStatus === 'pending' &&
                  (p.paymentMethod === 'card' || p.paymentMethod === 'pix')
              );

              if (purchase) {
                if (purchase.paymentStatus === 'paid') {
                  return { purchaseId: purchase.id, status: 'already_processed' };
                }

                const paymentStatus = (payment as any).status;

                if (paymentStatus === 'approved') {
                  await this.handlePaymentSuccess(purchase.id);
                  return { purchaseId: purchase.id, status: 'approved' };
                }

                if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
                  if (purchase.paymentStatus !== 'failed') {
                    await this.handlePaymentFailed(purchase.id);
                  }
                  return { purchaseId: purchase.id, status: 'failed' };
                }

                if (paymentStatus === 'expired' || paymentStatus === 'refunded') {
                  await this.handlePaymentExpired(purchase.id);
                  return { purchaseId: purchase.id, status: 'expired' };
                }

                if (paymentStatus === 'pending' || paymentStatus === 'in_process') {
                  return { purchaseId: purchase.id, status: 'pending' };
                }

                return { purchaseId: purchase.id, status: paymentStatus };
              }
            }
          }

          return null;
        }

        const purchasesList = await this.listPurchases();
        const purchase = purchasesList.find((p) => p.paymentId === preferenceId);

        if (!purchase) {
          return null;
        }

        if (purchase.paymentStatus === 'paid') {
          return { purchaseId: purchase.id, status: 'already_processed' };
        }

        const paymentStatus = (payment as any).status;
        const paymentMethodId = (payment as any).payment_method_id;

        if (paymentMethodId) {
          const detectedMethod: 'pix' | 'card' = paymentMethodId === 'pix' ? 'pix' : 'card';
          if (purchase.paymentMethod !== detectedMethod) {
            await db
              .update(purchases)
              .set({ paymentMethod: detectedMethod })
              .where(eq(purchases.id, purchase.id));
          }
        }

        if (paymentMethodId === 'pix') {
          if (paymentStatus === 'approved') {
            await this.handlePaymentSuccess(purchase.id);
            return { purchaseId: purchase.id, status: 'approved' };
          }

          if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
            if (purchase.paymentStatus !== 'failed') {
              await this.handlePaymentFailed(purchase.id);
            }
            return { purchaseId: purchase.id, status: 'failed' };
          }

          if (paymentStatus === 'expired' || paymentStatus === 'refunded') {
            await this.handlePaymentExpired(purchase.id);
            return { purchaseId: purchase.id, status: 'expired' };
          }

          if (paymentStatus === 'pending' || paymentStatus === 'in_process') {
            return { purchaseId: purchase.id, status: 'pending' };
          }
        }

        if (paymentStatus === 'approved') {
          await this.handlePaymentSuccess(purchase.id);
          return { purchaseId: purchase.id, status: 'approved' };
        }

        if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
          if (purchase.paymentStatus !== 'failed') {
            await this.handlePaymentFailed(purchase.id);
          }
          return { purchaseId: purchase.id, status: 'failed' };
        }

        if (paymentStatus === 'pending' || paymentStatus === 'in_process') {
          return { purchaseId: purchase.id, status: 'pending' };
        }

        return { purchaseId: purchase.id, status: paymentStatus };
      } catch (error) {
        console.error('Erro ao processar webhook do Mercado Pago:', error);
        return null;
      }
    }

    if (type === 'merchant_order') {
      return null;
    }

    return null;
  }
}

export const paymentsService = new PaymentsService();
