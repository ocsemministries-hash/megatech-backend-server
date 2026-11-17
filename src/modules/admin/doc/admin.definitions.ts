/** OpenAPI component schemas for the admin-management domain. */
export const adminDefinitions = {
  AdminInviteRequest: {
    type: 'object',
    required: ['firstName', 'lastName', 'email', 'roleId'],
    properties: {
      firstName: { type: 'string', example: 'Grace' },
      lastName: { type: 'string', example: 'Hopper' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', nullable: true },
      roleId: { type: 'string', format: 'uuid' },
    },
  },
  AdminAcceptInviteRequest: {
    type: 'object',
    required: ['password'],
    properties: { password: { type: 'string', format: 'password', minLength: 8 } },
  },
  AdminUpdateRequest: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      phone: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] },
      roleId: { type: 'string', format: 'uuid', nullable: true },
    },
  },
  AdminDto: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] },
      isSuperAdmin: { type: 'boolean' },
      roleId: { type: 'string', nullable: true },
      roleName: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'], nullable: true },
      permissions: { type: 'array', items: { type: 'string' } },
      lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  AdminListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          rows: { type: 'array', items: { $ref: '#/components/schemas/AdminDto' } },
          total: { type: 'integer' },
          page: { type: 'integer' },
          perPage: { type: 'integer' },
        },
      },
    },
  },
  AdminMessageResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: { type: 'object' },
    },
  },
} as const;
