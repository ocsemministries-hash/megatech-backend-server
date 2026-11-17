/** OpenAPI component schemas for the RBAC domain. */
export const rbacDefinitions = {
  RbacResourcesResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          resources: { type: 'array', items: { type: 'string' }, example: ['accounts', 'roles'] },
          actions: { type: 'array', items: { type: 'string' }, example: ['view', 'create'] },
        },
      },
    },
  },
  RbacRoleDto: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'] },
      description: { type: 'string', nullable: true },
      isSystem: { type: 'boolean' },
      permissionKeys: { type: 'array', items: { type: 'string' }, example: ['accounts:update'] },
      adminCount: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  RbacRoleListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: { roles: { type: 'array', items: { $ref: '#/components/schemas/RbacRoleDto' } } },
      },
    },
  },
  RbacUpdateRolePermissionsRequest: {
    type: 'object',
    required: ['permissionKeys'],
    properties: { permissionKeys: { type: 'array', items: { type: 'string' }, example: ['accounts:view', 'accounts:update'] } },
  },
} as const;
