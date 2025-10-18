import {pgTable, serial, varchar, boolean, timestamp, text, decimal, pgEnum, integer, foreignKey} from 'drizzle-orm/pg-core';

export const ageGroupEnum = pgEnum('age_group', ["adult", "child"]);
export const paymentStatusEnum = pgEnum('payment_status', ["pending", "paid", "failed"]);

// Guests table
export const guests = pgTable('guests', {
    id: serial('id').primaryKey(),
    name: varchar('name',{ length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    ageGroup: ageGroupEnum('age_group').notNull(),
    confirmed: boolean('confirmed').default(false).notNull(),
    confirmationDate: timestamp('confirmation_date',{withTimezone: true}),
})

// Gifts table  
export const gifts = pgTable("gifts", {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    available: boolean('available').default(true).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
})

// Purchases table 
export const purchases = pgTable("purchases", {
    id: serial('id').primaryKey(),
    guestId: integer('guest_id').notNull().references(() => guests.id),
    giftId: integer('gift_id').notNull().references(() => gifts.id),
    buyerName: varchar('buyer_name', { length: 100 }).notNull(),
    buyerPhone: varchar('buyer_phone', { length: 20 }).notNull(),
    paymentStatus: paymentStatusEnum('payment_status').default("pending").notNull(),
    paymentId: varchar('payment_id', { length: 255 }),
    purchasedAt: timestamp('purchased_at', {withTimezone: true}).defaultNow().notNull(),
})

// Memories table
export const memories = pgTable("memories",{
    id: serial('id').primaryKey(),
    url: text('url').notNull(),
    description: text('description'),
    uploadedAt: timestamp('uploaded_at',{withTimezone: true}).defaultNow().notNull(),
}) 

// Admins table
export const admins = pgTable("admins", {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
})