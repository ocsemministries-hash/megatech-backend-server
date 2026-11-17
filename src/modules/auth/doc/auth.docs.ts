/** OpenAPI path/operation docs for the auth domain. */
export const authDocs = {
  '/api/v1/admin/auth/register': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Register a super admin (email must be in ADMIN_MAILS)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRegisterRequest' } } } },
      responses: {
        '201': { description: 'Registration started, OTP sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthMessageResponse' } } } },
        '400': { description: 'Validation error' },
        '403': { description: 'Email not allowed to register' },
        '409': { description: 'Account already exists' },
      },
    },
  },
  '/api/v1/admin/auth/verify-email': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Verify admin email with OTP',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthVerifyEmailRequest' } } } },
      responses: {
        '200': { description: 'Email verified', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthMessageResponse' } } } },
        '401': { description: 'Invalid or expired code' },
      },
    },
  },
  '/api/v1/admin/auth/login': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Step 1 — sign in with credentials (issues MFA OTP)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthLoginRequest' } } } },
      responses: {
        '200': { description: 'OTP issued', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthOtpIssuedResponse' } } } },
        '401': { description: 'Invalid credentials' },
      },
    },
  },
  '/api/v1/admin/auth/otp': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Step 2 — confirm MFA OTP and receive httpOnly auth cookies',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthVerifyOtpRequest' } } } },
      responses: {
        '200': { description: 'Authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } } } },
        '401': { description: 'Invalid or expired code' },
        '429': { description: 'Too many failed attempts' },
      },
    },
  },
  '/api/v1/admin/auth/refresh': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Rotate tokens using the httpOnly refresh cookie',
      responses: {
        '200': { description: 'New cookie pair set', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } } } },
        '401': { description: 'Invalid/expired refresh token' },
      },
    },
  },
  '/api/v1/admin/auth/logout': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Revoke the refresh token (cookie) and clear cookies. Public: works after the access token expired',
      responses: { '200': { description: 'Signed out', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthMessageResponse' } } } } },
    },
  },
  '/api/v1/admin/auth/resend-otp': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Resend an OTP for email verification or login',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResendOtpRequest' } } } },
      responses: { '200': { description: 'OTP reissued', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthOtpIssuedResponse' } } } } },
    },
  },
  '/api/v1/admin/auth/me': {
    get: {
      tags: ['Admin Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Current admin profile with role + permissions',
      responses: { '200': { description: 'Profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } } } } },
    },
    patch: {
      tags: ['Admin Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Update own profile (first name, last name, phone); audited',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthUpdateMeRequest' } } } },
      responses: {
        '200': { description: 'Updated profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } } } },
        '400': { description: 'Validation error' },
        '401': { description: 'Unauthenticated' },
      },
    },
  },
  '/api/v1/admin/auth/google/link': {
    post: {
      tags: ['Admin Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Link a Google identity (Google email must match the admin email)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthGoogleRequest' } } } },
      responses: { '200': { description: 'Linked', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } } } } },
    },
    delete: {
      tags: ['Admin Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Unlink the Google identity; audited',
      responses: { '200': { description: 'Unlinked', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } } } } },
    },
  },
  '/api/v1/admin/auth/change-password': {
    post: {
      tags: ['Admin Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Change own password; signs out every other session',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthChangePasswordRequest' } } } },
      responses: {
        '200': { description: 'Password changed', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthChangePasswordResponse' } } } },
        '401': { description: 'Current password is incorrect' },
      },
    },
  },
  '/api/v1/admin/auth/forgot-password': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Request a password reset code (generic response, no account enumeration)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthForgotPasswordRequest' } } } },
      responses: {
        '200': { description: 'Reset code requested', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthOtpIssuedResponse' } } } },
        '400': { description: 'Validation error' },
      },
    },
  },
  '/api/v1/admin/auth/reset-password': {
    post: {
      tags: ['Admin Auth'],
      summary: 'Complete a password reset with the emailed code (revokes refresh tokens)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResetPasswordRequest' } } } },
      responses: {
        '200': { description: 'Password reset', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthMessageResponse' } } } },
        '401': { description: 'Invalid or expired code' },
        '429': { description: 'Too many failed attempts' },
      },
    },
  },
} as const;
