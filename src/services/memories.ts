import { desc } from 'drizzle-orm';
import { db } from '../db';
import { memories } from '../db/schema';

class MemoriesService {
  async list() {
    return db.select().from(memories).orderBy(desc(memories.uploadedAt));
  }

  async create(data: { url: string; description?: string }) {
    const [newMemory] = await db.insert(memories).values(data).returning();
    return newMemory;
  }
}

export const memoriesService = new MemoriesService();
