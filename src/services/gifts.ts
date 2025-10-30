import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { gifts, purchases } from '../db/schema';

class GiftsService {
  async list(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const rows = await db.select().from(gifts).limit(limit).offset(offset);
    const total = await db
      .select()
      .from(gifts)
      .then((r) => r.length);
    
    // Buscar compras pagas para cada presente
    const giftsWithPurchases = await Promise.all(
      rows.map(async (gift) => {
        const paidPurchases = await db
          .select({
            buyerName: purchases.buyerName,
            buyerEmail: purchases.buyerEmail,
            purchasedAt: purchases.purchasedAt,
            paymentMethod: purchases.paymentMethod,
          })
          .from(purchases)
          .where(and(eq(purchases.giftId, gift.id), eq(purchases.paymentStatus, 'paid')));
        
        return {
          ...gift,
          purchases: paidPurchases,
        };
      })
    );
    
    return { total, page, limit, gifts: giftsWithPurchases };
  }

  async getById(id: number) {
    const row = await db.select().from(gifts).where(eq(gifts.id, id)).limit(1);
    if (!row || row.length === 0) {
      return null;
    }
    
    const gift = row[0];
    
    // Buscar compras pagas para este presente
    const paidPurchases = await db
      .select({
        buyerName: purchases.buyerName,
        buyerEmail: purchases.buyerEmail,
        purchasedAt: purchases.purchasedAt,
        paymentMethod: purchases.paymentMethod,
      })
      .from(purchases)
      .where(and(eq(purchases.giftId, gift.id), eq(purchases.paymentStatus, 'paid')));
    
    return {
      ...gift,
      purchases: paidPurchases,
    };
  }

  async create(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    price: string;
    available?: boolean;
  }) {
    const [created] = await db
      .insert(gifts)
      .values({
        name: data.name,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        price: String(data.price),
        available: data.available ?? true,
      })
      .returning();

    return created;
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      imageUrl: string;
      price: string;
      available: boolean;
    }>
  ) {
    // Construir objeto de atualização explicitamente
    const updateData: Partial<{
      name: string;
      description: string | null;
      imageUrl: string | null;
      price: string;
      available: boolean;
    }> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    
    // Permitir definir como null para limpar campos
    if (data.description !== undefined) {
      updateData.description = data.description === '' ? null : data.description;
    }
    
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl === '' ? null : data.imageUrl;
    }
    
    if (data.price !== undefined) {
      updateData.price = String(data.price);
    }
    
    if (data.available !== undefined) {
      updateData.available = data.available;
    }

    // Validar se há pelo menos um campo para atualizar
    if (Object.keys(updateData).length === 0) {
      throw new Error('Nenhum campo para atualizar');
    }

    const [updated] = await db
      .update(gifts)
      .set(updateData)
      .where(eq(gifts.id, id))
      .returning();

    return updated || null;
  }

  async delete(id: number) {
    // Verificar se há compras associadas ao presente
    const associatedPurchases = await db
      .select()
      .from(purchases)
      .where(eq(purchases.giftId, id))
      .limit(1);

    if (associatedPurchases.length > 0) {
      throw new Error(
        'Não é possível excluir este presente pois existem compras associadas. ' +
        'Recomendação: marque o presente como indisponível (available: false) em vez de excluí-lo.'
      );
    }

    const [deleted] = await db.delete(gifts).where(eq(gifts.id, id)).returning();
    return deleted || null;
  }
}

export const giftsService = new GiftsService();
