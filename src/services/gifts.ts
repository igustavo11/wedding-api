import { eq } from 'drizzle-orm';
import { db } from '../db';
import { gifts } from '../db/schema';

class GiftsService {
  async list(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const rows = await db.select().from(gifts).limit(limit).offset(offset);
    const total = await db
      .select()
      .from(gifts)
      .then((r) => r.length);
    return { total, page, limit, gifts: rows };
  }

  async getById(id: number) {
    const row = await db.select().from(gifts).where(eq(gifts.id, id)).limit(1);
    return row && row.length > 0 ? row[0] : null;
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
    const [updated] = await db
      .update(gifts)
      .set({
        ...(data.name ? { name: data.name } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
        ...(data.price ? { price: String(data.price) } : {}),
        ...(data.available !== undefined ? { available: data.available } : {}),
      })
      .where(eq(gifts.id, id))
      .returning();

    return updated || null;
  }

  async delete(id: number) {
    const [deleted] = await db.delete(gifts).where(eq(gifts.id, id)).returning();
    return deleted || null;
  }
}

export const giftsService = new GiftsService();
