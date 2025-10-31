import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const ageGroupEnum = pgEnum('age_group', ['adult', 'child']);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'expired',
  'cancelled',
]);
export const paymentMethodEnum = pgEnum('payment_method', ['pix', 'card']);

// Guests table
export const guests = pgTable('guests', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  ageGroup: ageGroupEnum('age_group').notNull(),
  confirmed: boolean('confirmed').default(false).notNull(),
  confirmationDate: timestamp('confirmation_date', { withTimezone: true }),
});

// Gifts table
export const gifts = pgTable('gifts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  available: boolean('available').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Purchases table
export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  guestId: integer('guest_id').references(() => guests.id),
  giftId: integer('gift_id')
    .notNull()
    .references(() => gifts.id),
  buyerName: varchar('buyer_name', { length: 100 }).notNull(),
  buyerPhone: varchar('buyer_phone', { length: 20 }).notNull(),
  buyerEmail: varchar('buyer_email', { length: 100 }),
  buyerTaxId: varchar('buyer_tax_id', { length: 14 }),

  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),
  paymentId: varchar('payment_id', { length: 255 }),

  // abacastepay
  pixChargeId: varchar('pix_charge_id', { length: 255 }),
  pixQrCode: text('pix_qr_code'),
  pixQrCodeBase64: text('pix_qr_code_base64'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),

  metadata: text('metadata'),

  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Memories table
export const memories = pgTable('memories', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  description: text('description'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
