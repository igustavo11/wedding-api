import { parse } from 'csv-parse/sync';
import z from 'zod';

function snakeToCamel(key: string) {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function parseCSV(buffer: Buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const normalized = (records as Array<Record<string, unknown>>).map((rec) => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(rec)) {
      const camel = snakeToCamel(k);
      out[camel] = (rec as Record<string, unknown>)[k];
    }
    return out as Record<string, string>;
  });

  const schema = z.array(
    z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      ageGroup: z.enum(['adult', 'child']),
    })
  );

  return schema.parse(normalized);
}
