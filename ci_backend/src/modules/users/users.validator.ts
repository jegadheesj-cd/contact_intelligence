import { z } from 'zod';

export const updateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
    organization: z.string().min(2, 'Organization must be at least 2 characters').optional(),
    profileImage: z.string().url('Profile image must be a valid URL').or(z.string()).optional(),
  }),
});
