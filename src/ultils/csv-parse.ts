import { parse } from 'csv-parse/sync';
import z from 'zod';

export function parseCSV(buffer: Buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const schema = z.array(
    z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      ageGroup: z.enum(['adult', 'child']),
    })
  );
  return schema.parse(records);
}
