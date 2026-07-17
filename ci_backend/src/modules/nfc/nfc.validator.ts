import { z } from 'zod';

export const readNfcSchema = z.object({
  body: z.object({
    contactId: z.string().uuid('Invalid contactId format').optional().nullable(),
    payload: z.any().refine((val) => val !== undefined && val !== null, {
      message: 'NFC payload is required',
    }),
  }),
});
