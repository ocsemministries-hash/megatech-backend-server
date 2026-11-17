import { HttpError } from '@/lib/errors/http.error';

export class RbacRoleNotFoundError extends HttpError {
  constructor() {
    super(404, 'Role not found');
  }
}

export class RbacPermissionInvalidError extends HttpError {
  constructor() {
    super(400, 'One or more permission keys are invalid');
  }
}

export class RbacSystemRoleError extends HttpError {
  constructor() {
    super(400, 'System roles cannot be deleted');
  }
}

export class RbacSuperAdminRoleError extends HttpError {
  constructor() {
    super(400, 'The SUPER_ADMIN role cannot have its permissions reduced');
  }
}
