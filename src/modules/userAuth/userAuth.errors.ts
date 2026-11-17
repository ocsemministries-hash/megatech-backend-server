import { HttpError } from '@/lib/errors/http.error';

export class AccountAlreadyExistsError extends HttpError {
  constructor() {
    super(409, 'An account with this email already exists');
  }
}

export class InvalidCredentialsError extends HttpError {
  constructor() {
    super(401, 'Invalid email or password');
  }
}

export class AccountNotVerifiedError extends HttpError {
  constructor() {
    super(403, 'Account is not verified');
  }
}

export class AccountInactiveError extends HttpError {
  constructor() {
    super(403, 'Account is not active');
  }
}

export class InvalidOtpError extends HttpError {
  constructor() {
    super(401, 'Invalid or expired verification code');
  }
}

export class OtpMaxAttemptsError extends HttpError {
  constructor() {
    super(429, 'Too many failed attempts. Request a new code.');
  }
}

export class InvalidTokenError extends HttpError {
  constructor(message = 'Invalid or expired token') {
    super(401, message);
  }
}

export class GoogleAccountError extends HttpError {
  constructor(message = 'Google sign-in failed') {
    super(401, message);
  }
}

export class PasswordLoginRequiredError extends HttpError {
  constructor() {
    super(409, 'This account uses password sign-in — continue with email and password, or link Google after signing in');
  }
}
