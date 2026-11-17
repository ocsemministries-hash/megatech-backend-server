/** OpenAPI component schemas for the auth domain (components.schemas.auth.* namespace flattened). */
export const authDefinitions = {
  AuthRegisterRequest: {
    type: 'object',
    required: ['firstName', 'lastName', 'email', 'password'],
    properties: {
      firstName: { type: 'string', example: 'Ada' },
      lastName: { type: 'string', example: 'Lovelace' },
      email: { type: 'string', format: 'email', example: 'root@megatech.org' },
      password: { type: 'string', format: 'password', minLength: 8 },
    },
  },
  AuthVerifyEmailRequest: {
    type: 'object',
    required: ['email', 'otp'],
    properties: {
      email: { type: 'string', format: 'email' },
      otp: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
    },
  },
  AuthLoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password' },
    },
  },
  AuthVerifyOtpRequest: {
    type: 'object',
    required: ['email', 'otp'],
    properties: {
      email: { type: 'string', format: 'email' },
      otp: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
    },
  },
  AuthResendOtpRequest: {
    type: 'object',
    required: ['email', 'purpose'],
    properties: {
      email: { type: 'string', format: 'email' },
      purpose: { type: 'string', enum: ['verify_email', 'login'] },
    },
  },
  AuthChangePasswordRequest: {
    type: 'object',
    required: ['oldPassword', 'newPassword'],
    properties: {
      oldPassword: { type: 'string', format: 'password' },
      newPassword: { type: 'string', format: 'password', minLength: 8 },
    },
  },
  AuthUpdateMeRequest: {
    type: 'object',
    description: 'At least one field. Email, role and status are not editable here.',
    properties: {
      firstName: { type: 'string', maxLength: 100 },
      lastName: { type: 'string', maxLength: 100 },
      phone: { type: 'string', maxLength: 50, nullable: true },
    },
  },
  AuthGoogleRequest: {
    type: 'object',
    required: ['idToken'],
    properties: { idToken: { type: 'string', description: 'Google Identity Services ID token' } },
  },
  AuthChangePasswordResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Password changed' },
          otherSessionsSignedOut: { type: 'integer', example: 2 },
        },
      },
    },
  },
  AuthForgotPasswordRequest: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', example: 'root@megatech.org' },
    },
  },
  AuthResetPasswordRequest: {
    type: 'object',
    required: ['email', 'otp', 'newPassword'],
    properties: {
      email: { type: 'string', format: 'email' },
      otp: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
      newPassword: { type: 'string', format: 'password', minLength: 8 },
    },
  },
  AuthAdminDto: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] },
      isSuperAdmin: { type: 'boolean' },
      roleName: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'], nullable: true },
      permissions: { type: 'array', items: { type: 'string' }, example: ['accounts:update'] },
      hasGoogle: { type: 'boolean', description: 'A Google identity is linked' },
      lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  AuthSessionResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          admin: { $ref: '#/components/schemas/AuthAdminDto' },
        },
      },
    },
  },
  AuthMessageResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { type: 'object', properties: { message: { type: 'string' } } },
    },
  },
  AuthOtpIssuedResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          expiresInMinutes: { type: 'integer', example: 10 },
          requiresOtp: { type: 'boolean' },
        },
      },
    },
  },
} as const;
