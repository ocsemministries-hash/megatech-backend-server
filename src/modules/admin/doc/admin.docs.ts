const adminErrorResponses = {
  '401': { description: 'Unauthenticated' },
  '403': { description: 'Forbidden — insufficient permissions' },
  '404': { description: 'Admin not found' },
};

/** OpenAPI path/operation docs for the admin-management domain. */
export const adminDocs = {
  '/api/v1/admin/admins': {
    get: {
      tags: ['Admins'],
      security: [{ bearerAuth: [] }],
      summary: 'List admins (paginated, searchable)',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'perPage', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: 'Admin page', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminListResponse' } } } },
        ...adminErrorResponses,
      },
    },
  },
  '/api/v1/admin/admins/{id}': {
    get: {
      tags: ['Admins'],
      security: [{ bearerAuth: [] }],
      summary: 'Get a single admin with role + permissions',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Admin detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminMessageResponse' } } } },
        ...adminErrorResponses,
      },
    },
    patch: {
      tags: ['Admins'],
      security: [{ bearerAuth: [] }],
      summary: 'Update an admin (name/phone/status/role)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminUpdateRequest' } } } },
      responses: { '200': { description: 'Updated admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminMessageResponse' } } } }, ...adminErrorResponses },
    },
    delete: {
      tags: ['Admins'],
      security: [{ bearerAuth: [] }],
      summary: 'Delete an admin (super admins only)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminMessageResponse' } } } }, ...adminErrorResponses },
    },
  },
  '/api/v1/admin/admins/invite': {
    post: {
      tags: ['Admins'],
      security: [{ bearerAuth: [] }],
      summary: 'Invite an admin by email (emails an invitation link)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminInviteRequest' } } } },
      responses: {
        '201': { description: 'Invitation sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminMessageResponse' } } } },
        ...adminErrorResponses,
      },
    },
  },
  '/api/v1/admin/invite/{token}/accept': {
    post: {
      tags: ['Admins'],
      summary: 'Accept an invitation (public — token is the credential)',
      parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminAcceptInviteRequest' } } } },
      responses: { '200': { description: 'Invitation accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminMessageResponse' } } } }, '401': { description: 'Invalid or expired invitation' } },
    },
  },
} as const;
