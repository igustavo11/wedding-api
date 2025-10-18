import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: false,
});

export const db = drizzle(pool, { schema });