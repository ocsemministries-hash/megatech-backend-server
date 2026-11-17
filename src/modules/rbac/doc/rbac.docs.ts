const rbacErrors = {
  '401': { description: 'Unauthenticated' },
  '403': { description: 'Forbidden — insufficient permissions' },
  '404': { description: 'Not found' },
};

/** OpenAPI path/operation docs for the RBAC domain. */
export const rbacDocs = {
  '/api/v1/admin/rbac/resources': {
    get: {
      tags: ['RBAC'],
      security: [{ bearerAuth: [] }],
      summary: 'List the RBAC resource/action registry (drives the permission matrix UI)',
      responses: { '200': { description: 'Registry', content: { 'application/json': { schema: { $ref: '#/components/schemas/RbacResourcesResponse' } } } }, ...rbacErrors },
    },
  },
  '/api/v1/admin/roles': {
    get: {
      tags: ['RBAC'],
      security: [{ bearerAuth: [] }],
      summary: 'List roles with permission keys and admin counts',
      responses: { '200': { description: 'Role list', content: { 'application/json': { schema: { $ref: '#/components/schemas/RbacRoleListResponse' } } } }, ...rbacErrors },
    },
  },
  '/api/v1/admin/roles/{id}': {
    get: {
      tags: ['RBAC'],
      security: [{ bearerAuth: [] }],
      summary: 'Get a role',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Role detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/RbacRoleListResponse' } } } }, ...rbacErrors },
    },
    delete: {
      tags: ['RBAC'],
      security: [{ bearerAuth: [] }],
      summary: 'Delete a non-system role (system roles are protected)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Deleted' }, ...rbacErrors },
    },
  },
  '/api/v1/admin/roles/{id}/permissions': {
    patch: {
      tags: ['RBAC'],
      security: [{ bearerAuth: [] }],
      summary: 'Replace a role permission set',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/RbacUpdateRolePermissionsRequest' } } } },
      responses: { '200': { description: 'Updated role', content: { 'application/json': { schema: { $ref: '#/components/schemas/RbacRoleListResponse' } } } }, ...rbacErrors },
    },
  },
} as const;
