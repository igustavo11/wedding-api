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
  CLOUDINARY_URL: process.env.CLOUDINARY_URL || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  MERCADOPAGO_PUBLIC_KEY: process.env.MERCADOPAGO_PUBLIC_KEY || '',
  MERCADOPAGO_SUCCESS_URL:
    process.env.MERCADOPAGO_SUCCESS_URL || 'http://localhost:8080/payment/success',
  MERCADOPAGO_FAILURE_URL:
    process.env.MERCADOPAGO_FAILURE_URL || 'http://localhost:8080/payment/failure',
  MERCADOPAGO_PENDING_URL:
    process.env.MERCADOPAGO_PENDING_URL || 'http://localhost:8080/payment/pending',
  MERCADOPAGO_URL_WEBHOOK: process.env.MERCADOPAGO_URL_WEBHOOK || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8080',
};
