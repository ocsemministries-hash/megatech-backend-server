import { HttpError } from '@/lib/errors/http.error';

export class AdminNotFoundError extends HttpError {
  constructor() {
    super(404, 'Admin not found');
  }
}

export class AdminAlreadyExistsError extends HttpError {
  constructor() {
    super(409, 'An account with this email already exists');
  }
}

export class SuperAdminRoleChangeError extends HttpError {
  constructor() {
    super(400, 'A super admin must retain the SUPER_ADMIN role');
  }
}

export class CannotModifySuperAdminError extends HttpError {
  constructor() {
    super(403, 'Super admins can only be managed by another super admin');
  }
}

export class CannotDeleteSelfError extends HttpError {
  constructor() {
    super(400, 'You cannot delete your own account');
  }
}

export class CannotSuspendSelfError extends HttpError {
  constructor() {
    super(400, 'You cannot suspend your own account');
  }
}

export class InviteInvalidError extends HttpError {
  constructor() {
    super(401, 'Invalid or expired invitation');
  }
}

export class RoleNotFoundError extends HttpError {
  constructor() {
    super(404, 'Role not found');
  }
}
