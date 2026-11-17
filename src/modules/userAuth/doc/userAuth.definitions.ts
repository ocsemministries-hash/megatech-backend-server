/** OpenAPI component schemas for the partner user-auth domain. */
export const userAuthDefinitions = {
  UserAuthRegisterRequest: {
    type: 'object',
    required: ['firstName', 'lastName', 'email', 'password'],
    properties: {
      firstName: { type: 'string', example: 'Sarah' },
      lastName: { type: 'string', example: 'Jenkins' },
      email: { type: 'string', format: 'email', example: 'sarah@example.com' },
      password: { type: 'string', format: 'password', minLength: 8 },
    },
  },
  UserAuthVerifyEmailRequest: {
    type: 'object',
    required: ['email', 'otp'],
    properties: {
      email: { type: 'string', format: 'email' },
      otp: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
    },
  },
  UserAuthLoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password' },
    },
  },
  UserAuthVerifyOtpRequest: {
    type: 'object',
    required: ['email', 'otp'],
    properties: {
      email: { type: 'string', format: 'email' },
      otp: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
    },
  },
  UserAuthGoogleRequest: {
    type: 'object',
    required: ['idToken'],
    properties: {
      idToken: { type: 'string', description: 'Google Identity Services ID token' },
    },
  },
  UserAuthResendOtpRequest: {
    type: 'object',
    required: ['email', 'purpose'],
    properties: {
      email: { type: 'string', format: 'email' },
      purpose: { type: 'string', enum: ['verify_email', 'login'] },
    },
  },
  UserAuthChangePasswordRequest: {
    type: 'object',
    required: ['oldPassword', 'newPassword'],
    properties: {
      oldPassword: { type: 'string', format: 'password' },
      newPassword: { type: 'string', format: 'password', minLength: 8 },
    },
  },
  UserAuthForgotPasswordRequest: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', example: 'sarah@example.com' },
    },
  },
  UserAuthResetPasswordRequest: {
    type: 'object',
    required: ['email', 'otp', 'newPassword'],
    properties: {
      email: { type: 'string', format: 'email' },
      otp: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
      newPassword: { type: 'string', format: 'password', minLength: 8 },
    },
  },
  UserPublicResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] },
      hasPassword: { type: 'boolean' },
      hasGoogle: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
};
