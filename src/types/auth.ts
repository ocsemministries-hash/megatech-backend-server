export interface AdminPrincipal {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string | null;
  roleName: string | null;
  isSuperAdmin: boolean;
  /** Flat list of granted keys, e.g. `accounts:update`. */
  permissions: string[];
}

export interface UserPrincipal {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPrincipal;
      user?: UserPrincipal;
      rawBody?: Buffer;
    }
  }
}
