const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 3338);

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'wedding';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
const DB_SSL = (process.env.DB_SSL || 'false').toLowerCase() === 'true';

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || '';
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3338';

if (NODE_ENV === 'production' && !BETTER_AUTH_SECRET) {
  console.error(
    'BETTER_AUTH_SECRET is required in production. Set BETTER_AUTH_SECRET environment variable.'
  );
  process.exit(1);
}

export const env = {
  PORT,
  DATABASE_URL,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_SSL,
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL,
  NODE_ENV,
};
