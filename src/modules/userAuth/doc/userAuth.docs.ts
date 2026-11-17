/** OpenAPI path/operation docs for the partner user-auth domain. */
export const userAuthDocs = {
  '/api/v1/auth/register': {
    post: {
      tags: ['Partner Auth'],
      summary: 'Register a partner account (open sign-up, OTP emailed)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UserAuthRegisterRequest' } } } },
      responses: {
        '201': { description: 'Registration started, OTP sent' },
        '400': { description: 'Validation error' },
        '409': { description: 'Account already exists' },
      },
    },
  },
  '/api/v1/auth/verify-email': {
    post: {
      tags: ['Partner Auth'],
      summary: 'Verify partner email with OTP',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UserAuthVerifyEmailRequest' } } } },
      responses: {
        '200': { description: 'Email verified' },
        '401': { description: 'Invalid or expired code' },
      },
    },
  },
  '/api/v1/auth/login': {
    post: {
      tags: ['Partner Auth'],
      summary: 'Step 1 — sign in with credentials (issues MFA OTP)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UserAuthLoginRequest' } } } },
      responses: {
        '200': { description: 'OTP issued' },
        '401': { description: 'Invalid credentials' },
      },
    },
  },
  '/api/v1/auth/otp': {
    post: {
      tags: ['Partner Auth'],
      summary: 'Step 2 — confirm MFA OTP and receive httpOnly auth cookies',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UserAuthVerifyOtpRequest' } } } },
      responses: {
        '200': { description: 'Authenticated' },
        '401': { description: 'Invalid or expired code' },
        '429': { description: 'Too many failed attempts' },
      },
    },
  },
  '/api/v1/auth/google': {
    post: {
      tags: ['Partner Auth'],
      summary: 'Sign in / sign up with a Google ID token (auto-provisions)',
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UserAuthGoogleRequest' } } } },
      responses: {
        '200': { description: 'Authenticated, cookies set' },
        '401': { description: 'Invalid Google credential' },
      },
    },
  },
  '/api/v1/auth/refresh': {
    post: {
      tags: ['Partner Auth'],
      summary: 'Rotate the session (refresh cookie → new cookie pair)',
      responses: {
        '200': { description: 'Session rotated' },
        '401': { description: 'Invalid or expired refresh token' },
      },
    },
  },
  '/api/v1/auth/logout': {
    post: {
      tags: ['Partner Auth'],
      summary: 'Sign out (consumes refresh token, clears cookies)',
      responses: { '200': { description: 'Signed out' } },
    },
  },
  '/api/v1/auth/me': {
    get: {
      tags: ['Partner Auth'],
      summary: 'Current partner profile (fresh from DB)',
      responses: {
        '200': { description: 'Profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserPublicResponse' } } } },
        '401': { description: 'Unauthorized' },
      },
    },
  },
};
