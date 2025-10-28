import { eq } from 'drizzle-orm';
import { db } from '../db';
import { gifts, purchases } from '../db/schema';
import { abacatePayClient } from '../lib/abacatepay';

interface CreatePixPaymentParams {
  giftId: number;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerTaxId: string; // CPF
  guestId?: number;
}

class PaymentsService {
  private cleanTaxId(taxId: string): string {
    return taxId.replace(/\D/g, '');
  }

  async createPixPayment(params: CreatePixPaymentParams) {
    const cleanedTaxId = this.cleanTaxId(params.buyerTaxId);

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, params.giftId)).limit(1);

    if (!gift) {
      throw new Error('Presente não encontrado');
    }

    if (!gift.available) {
      throw new Error('Presente não está disponível para compra');
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

    const priceInCents = Math.round(Number.parseFloat(gift.price) * 100);

    const pixResponse = await abacatePayClient.createPixQrCode({
      amount: priceInCents,
      expiresIn: 3600,
      description: `Presente de casamento: ${gift.name}`,
      customer: {
        name: params.buyerName,
        cellphone: params.buyerPhone,
        email: params.buyerEmail,
        taxId: cleanedTaxId,
      },
      metadata: {
        giftId: params.giftId,
        giftName: gift.name,
      },
    });

    if (pixResponse.error || !pixResponse.data) {
      throw new Error(`Erro ao criar pagamento PIX: ${pixResponse.error}`);
    }

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
        paymentId: pixResponse.data.id,
        pixChargeId: pixResponse.data.id,
        pixQrCode: pixResponse.data.brCode,
        pixQrCodeBase64: pixResponse.data.brCodeBase64,
        expiresAt: new Date(pixResponse.data.expiresAt),
        metadata: JSON.stringify({
          devMode: pixResponse.data.devMode,
          platformFee: pixResponse.data.platformFee,
        }),
      })
      .returning();

    await db.update(gifts).set({ available: false }).where(eq(gifts.id, params.giftId));

    return {
      purchase,
      gift,
      pixData: {
        qrCode: pixResponse.data.brCode,
        qrCodeBase64: pixResponse.data.brCodeBase64,
        amount: pixResponse.data.amount,
        expiresAt: pixResponse.data.expiresAt,
      },
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

    if (purchase.pixChargeId) {
      try {
        const statusResponse = await abacatePayClient.checkPixQrCode(purchase.pixChargeId);

        if (statusResponse.data.status === 'PAID') {
          await this.handlePaymentSuccess(purchaseId);
          const [updatedPurchase] = await db
            .select()
            .from(purchases)
            .where(eq(purchases.id, purchaseId))
            .limit(1);
          return {
            purchase: updatedPurchase,
            needsUpdate: true,
          };
        }

        if (statusResponse.data.status === 'EXPIRED') {
          await this.handlePaymentExpired(purchaseId);
          const [updatedPurchase] = await db
            .select()
            .from(purchases)
            .where(eq(purchases.id, purchaseId))
            .limit(1);
          return {
            purchase: updatedPurchase,
            needsUpdate: true,
          };
        }
      } catch (error) {
        console.error('Erro ao verificar status na AbacatePay:', error);
      }
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

    await db
      .update(purchases)
      .set({
        paymentStatus: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchaseId));

    await db.update(gifts).set({ available: false }).where(eq(gifts.id, purchase.giftId));

    console.log(`✅ Pagamento aprovado para compra #${purchaseId}`);
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

    console.log(`⏰ Pagamento expirado para compra #${purchaseId}`);
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

    console.log(`❌ Pagamento cancelado para compra #${purchaseId}`);
  }

  async simulatePayment(purchaseId: number) {
    if (!abacatePayClient.isDevMode()) {
      throw new Error('Simulação de pagamento só é permitida em Dev Mode');
    }

    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      throw new Error('Compra não encontrada');
    }

    if (purchase.paymentStatus !== 'pending') {
      throw new Error('Apenas pagamentos pendentes podem ser simulados');
    }

    if (!purchase.pixChargeId) {
      throw new Error('Compra não possui ID do PIX');
    }

    await abacatePayClient.simulatePixPayment(purchase.pixChargeId);

    await this.handlePaymentSuccess(purchaseId);

    return { message: 'Pagamento simulado com sucesso' };
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
}

export const paymentsService = new PaymentsService();
