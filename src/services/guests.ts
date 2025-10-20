import type { MultipartFile } from "@fastify/multipart";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { guests } from "../db/schema";
import { parseCSV } from "../ultils/csv-parse";

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
        })),
      )
      .returning();

    return {
      message: "Guests imported successfully",
      count: inserted.length,
      guests: inserted,
    };
  }

  async getFamilyByPhone(phone: string) {
    const family = await db
      .select()
      .from(guests)
      .where(eq(guests.phone, phone));

    const adults = family.filter((member) => member.ageGroup === "adult");
    const children = family.filter((member) => member.ageGroup === "child");

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
      message: "Guests confirmed successfully",
      count: guestIds.length,
    };
  }

  async confirmByPhone(
    phone: string,
    confirmations: { id: number; confirmed: boolean }[],
  ) {
    const family = await db
      .select()
      .from(guests)
      .where(eq(guests.phone, phone));

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
        })
        .where(eq(guests.id, confirmation.id))
        .returning();

      updated.push(result);
    }

    return {
      message: "Guest confirmations updated successfully",
      phone,
      count: confirmations.length,
      guests: updated,
    };
  }

  async getGuestsByStatus(confirmed: boolean) {
    const guestList = await db
      .select()
      .from(guests)
      .where(eq(guests.confirmed, confirmed));

    const adults = guestList.filter((guest) => guest.ageGroup === "adult");
    const children = guestList.filter((guest) => guest.ageGroup === "child");

    const status = confirmed ? "Confirmed" : "Unconfirmed";

    return {
      message: `${status} guests retrieved successfully`,
      status: confirmed ? "confirmed" : "unconfirmed",
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

  async getConfirmationStats() {
    const allGuests = await db.select().from(guests);
    const confirmed = allGuests.filter((g) => g.confirmed);
    const unconfirmed = allGuests.filter((g) => !g.confirmed);

    const confirmedAdults = confirmed.filter((g) => g.ageGroup === "adult");
    const confirmedChildren = confirmed.filter((g) => g.ageGroup === "child");
    const unconfirmedAdults = unconfirmed.filter((g) => g.ageGroup === "adult");
    const unconfirmedChildren = unconfirmed.filter(
      (g) => g.ageGroup === "child",
    );

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
}

export const guestsService = new GuestsService();
