import type { MultipartFile } from '@fastify/multipart';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { guests } from '../db/schema';
import { parseCSV } from '../ultils/csv-parse';

class GuestsService {
  async importFromCSV(file: MultipartFile) {
    const csvContent = await file.toBuffer();
    const records = parseCSV(csvContent);

    const inserted = await db
      .insert(guests)
      .values(
        records.map((record) => ({
          name: record.name,
          phone: record.phone,
          ageGroup: record.ageGroup,
        }))
      )
      .returning();

    return {
      message: 'Guests imported successfully',
      count: inserted.length,
      guests: inserted,
    };
  }

  async getFamilyByPhone(phone: string) {
    const family = await db.select().from(guests).where(eq(guests.phone, phone));

    const adults = family.filter((member) => member.ageGroup === 'adult');
    const children = family.filter((member) => member.ageGroup === 'child');

    return {
      phone,
      total: family.length,
      adults: {
        count: adults.length,
        guests: adults,
      },
      children: {
        count: children.length,
        guests: children,
      },
    };
  }

  async confirmGuests(guestIds: number[]) {
    for (const id of guestIds) {
      await db
        .update(guests)
        .set({
          confirmed: true,
          confirmationDate: new Date(),
        })
        .where(eq(guests.id, id));
    }

    return {
      message: 'Guests confirmed successfully',
      count: guestIds.length,
    };
  }

  async confirmByPhone(phone: string, confirmations: { id: number; confirmed: boolean }[]) {
    const family = await db.select().from(guests).where(eq(guests.phone, phone));

    if (family.length === 0) {
      return null;
    }
    const updated = [];
    for (const confirmation of confirmations) {
      const [result] = await db
        .update(guests)
        .set({
          confirmed: confirmation.confirmed,
          confirmationDate: confirmation.confirmed ? new Date() : null,
          attendanceStatus: confirmation.confirmed ? 'confirmed' : 'pending',
        })
        .where(eq(guests.id, confirmation.id))
        .returning();

      updated.push(result);
    }

    return {
      message: 'Guest confirmations updated successfully',
      phone,
      count: confirmations.length,
      guests: updated,
    };
  }

  async getGuestsByStatus(confirmed: boolean) {
    const guestList = await db.select().from(guests).where(eq(guests.confirmed, confirmed));

    const adults = guestList.filter((guest) => guest.ageGroup === 'adult');
    const children = guestList.filter((guest) => guest.ageGroup === 'child');

    const status = confirmed ? 'Confirmed' : 'Unconfirmed';

    return {
      message: `${status} guests retrieved successfully`,
      status: confirmed ? 'confirmed' : 'unconfirmed',
      total: guestList.length,
      adults: {
        count: adults.length,
        guests: adults,
      },
      children: {
        count: children.length,
        guests: children,
      },
      guests: guestList,
    };
  }

  async listGuests(page = 1, limit = 100) {
    const offset = (page - 1) * limit;
    const guestsList = await db.select().from(guests).limit(limit).offset(offset);

    const total = await db
      .select()
      .from(guests)
      .then((rows) => rows.length);

    return {
      total,
      page,
      limit,
      guests: guestsList,
    };
  }

  async getConfirmationStats() {
    const allGuests = await db.select().from(guests);
    const confirmed = allGuests.filter((g) => g.confirmed);
    const unconfirmed = allGuests.filter((g) => !g.confirmed);

    const confirmedAdults = confirmed.filter((g) => g.ageGroup === 'adult');
    const confirmedChildren = confirmed.filter((g) => g.ageGroup === 'child');
    const unconfirmedAdults = unconfirmed.filter((g) => g.ageGroup === 'adult');
    const unconfirmedChildren = unconfirmed.filter((g) => g.ageGroup === 'child');

    return {
      total: allGuests.length,
      confirmed: {
        total: confirmed.length,
        adults: confirmedAdults.length,
        children: confirmedChildren.length,
      },
      unconfirmed: {
        total: unconfirmed.length,
        adults: unconfirmedAdults.length,
        children: unconfirmedChildren.length,
      },
      percentage: {
        confirmed: Math.round((confirmed.length / allGuests.length) * 100),
      },
    };
  }

  // Admin CRUD: create, update, delete
  async createGuest(payload: { name: string; phone: string; ageGroup: 'adult' | 'child' }) {
    const [created] = await db
      .insert(guests)
      .values({
        name: payload.name,
        phone: payload.phone,
        ageGroup: payload.ageGroup,
      })
      .returning();

    return created;
  }

  async updateGuest(
    id: number,
    payload: Partial<{
      name: string;
      phone: string;
      ageGroup: 'adult' | 'child';
      confirmed: boolean;
      attendanceStatus: 'pending' | 'confirmed' | 'declined';
    }>
  ) {
    const [updated] = await db
      .update(guests)
      .set({
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        ...(payload.ageGroup !== undefined ? { ageGroup: payload.ageGroup } : {}),
        ...(payload.confirmed !== undefined
          ? {
              confirmed: payload.confirmed,
              confirmationDate: payload.confirmed ? new Date() : null,
            }
          : {}),
        ...(payload.attendanceStatus !== undefined
          ? { attendanceStatus: payload.attendanceStatus }
          : {}),
      })
      .where(eq(guests.id, id))
      .returning();

    return updated || null;
  }

  async deleteGuest(id: number) {
    const [deleted] = await db.delete(guests).where(eq(guests.id, id)).returning();
    return deleted || null;
  }

  async updateAttendanceStatus(
    phone: string,
    attendanceUpdates: { id: number; attendanceStatus: 'pending' | 'confirmed' | 'declined' }[]
  ) {
    const family = await db.select().from(guests).where(eq(guests.phone, phone));

    if (family.length === 0) {
      return null;
    }

    const updated = [];
    for (const update of attendanceUpdates) {
      const [result] = await db
        .update(guests)
        .set({
          attendanceStatus: update.attendanceStatus,
          confirmed: update.attendanceStatus === 'confirmed',
          confirmationDate: update.attendanceStatus === 'confirmed' ? new Date() : null,
        })
        .where(eq(guests.id, update.id))
        .returning();

      updated.push(result);
    }

    return {
      message: 'Guest attendance status updated successfully',
      phone,
      count: updated.length,
      guests: updated,
    };
  }

  async getGuestsByAttendanceStatus(status: 'pending' | 'confirmed' | 'declined') {
    const guestList = await db.select().from(guests).where(eq(guests.attendanceStatus, status));

    const adults = guestList.filter((guest) => guest.ageGroup === 'adult');
    const children = guestList.filter((guest) => guest.ageGroup === 'child');

    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      declined: 'Declined',
    };

    return {
      message: `${statusLabels[status]} guests retrieved successfully`,
      status,
      total: guestList.length,
      adults: {
        count: adults.length,
        guests: adults,
      },
      children: {
        count: children.length,
        guests: children,
      },
      guests: guestList,
    };
  }
}

export const guestsService = new GuestsService();
