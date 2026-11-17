import { z } from 'zod';

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().min(1)).min(0).max(500),
});

export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;
