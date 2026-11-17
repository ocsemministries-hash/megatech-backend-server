import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email('A valid email is required').max(255);
const nameField = (label: string) => z.string().trim().min(1, `${label} is required`).max(100);

export const inviteAdminSchema = z.object({
  firstName: nameField('First name'),
  lastName: nameField('Last name'),
  email: emailSchema,
  roleId: z.string().uuid('A valid role id is required'),
  phone: z.string().trim().max(50).optional().nullable(),
});

export const acceptInviteSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const updateAdminSchema = z
  .object({
    firstName: nameField('First name').optional(),
    lastName: nameField('Last name').optional(),
    phone: z.string().trim().max(50).optional().nullable(),
    status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
    roleId: z.string().uuid('A valid role id is required').optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const listAdminsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export type InviteAdminDto = z.infer<typeof inviteAdminSchema>;
export type AcceptInviteDto = z.infer<typeof acceptInviteSchema>;
export type UpdateAdminDto = z.infer<typeof updateAdminSchema>;
export type ListAdminsQuery = z.infer<typeof listAdminsQuerySchema>;
