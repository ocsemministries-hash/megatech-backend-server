import type { Admin } from '@prisma/client';
import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { hashPassword } from '@/utils/password';
import { generateOpaqueToken, hashToken } from '@/utils/tokens';
import { AdminRepository } from '@/lib/dal/repositories/admin/admin.repository';
import { RoleRepository } from '@/lib/dal/repositories/role/role.repository';
import { VerificationTokenRepository } from '@/lib/dal/repositories/verificationToken/verificationToken.repository';
import { eventBus } from '@/lib/events/event-bus';
import { ADMIN_EVENTS } from './admin.events';
import type { InviteAcceptedPayload, InviteCreatedPayload } from './admin.events';
import { recordAudit } from '@/modules/audit/audit.events';
import type { AdminActor, AdminWithPermissions } from '@/lib/security/principal';
import type { AdminListParams, AdminListResult } from './admin.types';
import {
  AdminAlreadyExistsError,
  AdminNotFoundError,
  CannotDeleteSelfError,
  CannotModifySuperAdminError,
  CannotSuspendSelfError,
  InviteInvalidError,
  RoleNotFoundError,
  SuperAdminRoleChangeError,
} from './admin.errors';
import type { AcceptInviteDto, InviteAdminDto, UpdateAdminDto } from './validation.schema';

export class AdminUsecases {
  constructor(
    private readonly admins: AdminRepository = new AdminRepository(),
    private readonly roles: RoleRepository = new RoleRepository(),
    private readonly tokens: VerificationTokenRepository = new VerificationTokenRepository()
  ) {}

  async list(params: AdminListParams): Promise<AdminListResult> {
    const { rows, total } = await this.admins.list(params);
    return {
      rows,
      total,
      page: params.page ?? 1,
      perPage: params.perPage ?? 20,
    };
  }

  async getById(id: string): Promise<AdminWithPermissions> {
    const admin = await this.admins.findByIdWithRole(id);
    if (!admin) throw new AdminNotFoundError();
    return admin;
  }

  /** Creates a PENDING admin and emails an invitation link. */
  async invite(actor: AdminActor, input: InviteAdminDto): Promise<AdminWithPermissions> {
    const role = await this.roles.findById(input.roleId);
    if (!role) throw new RoleNotFoundError();
    if (role.isSystem && role.name === 'SUPER_ADMIN') {
      throw new CannotModifySuperAdminError();
    }

    const existing = await this.admins.findByEmail(input.email);
    if (existing) throw new AdminAlreadyExistsError();

    // Placeholder hash — invitee sets the real password on accept.
    const placeholder = await hashPassword(generateOpaqueToken(12));
    const admin = await this.admins.createAdmin({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      passwordHash: placeholder,
      status: 'PENDING',
      isSuperAdmin: false,
      roleId: input.roleId,
    });

    const raw = generateOpaqueToken();
    await this.tokens.createToken({
      tokenType: 'INVITE',
      adminId: admin.id,
      identifier: admin.email,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + ENV.INVITE_TTL_HOURS * 60 * 60 * 1000),
    });

    const inviteUrl = `${ENV.ADMIN_WEB_URL}/admin/invite?token=${raw}`;
    // Invite email leaves the request path; the PENDING admin + INVITE token
    // rows are already committed above.
    eventBus.safeEmit<InviteCreatedPayload>(ADMIN_EVENTS.INVITE_CREATED, {
      actorName: `${actor.firstName} ${actor.lastName}`,
      adminId: admin.id,
      email: admin.email,
      roleName: role.name,
      inviteUrl,
      expiresInHours: ENV.INVITE_TTL_HOURS,
    });

    recordAudit({
      action: 'admin.invited',
      actorId: actor.id,
      resource: `admin:${admin.id}`,
      meta: { email: admin.email, roleName: role.name, invitedBy: actor.email },
    });

    logger.info(`[admin] ${actor.email} invited ${admin.email} as ${role.name}`);
    return this.getById(admin.id);
  }

  /** Completes an invitation by setting the password and activating the admin. */
  async acceptInvite(rawToken: string, input: AcceptInviteDto): Promise<AdminWithPermissions> {
    const token = await this.tokens.findByHash(hashToken(rawToken));
    if (!token || token.tokenType !== 'INVITE' || token.consumedAt || token.expiresAt.getTime() < Date.now()) {
      throw new InviteInvalidError();
    }
    if (!token.adminId) throw new InviteInvalidError();

    const admin = await this.admins.findById(token.adminId);
    if (!admin || admin.status !== 'PENDING') throw new InviteInvalidError();

    const passwordHash = await hashPassword(input.password);
    const updated = await this.admins.updateAdmin(admin.id, { passwordHash, status: 'ACTIVE' });
    await this.tokens.markConsumed(token.id);

    eventBus.safeEmit<InviteAcceptedPayload>(ADMIN_EVENTS.INVITE_ACCEPTED, {
      adminId: admin.id,
      email: admin.email,
      firstName: admin.firstName,
    });

    recordAudit({
      action: 'admin.invite_accepted',
      actorId: admin.id,
      resource: `admin:${admin.id}`,
      meta: { email: admin.email },
    });

    logger.info(`[admin] invite accepted by ${admin.email}`);
    return this.getById(updated.id);
  }

  /** Updates mutable admin fields with super-admin protections. */
  async update(actor: AdminActor, id: string, input: UpdateAdminDto): Promise<AdminWithPermissions> {
    const target = await this.admins.findById(id);
    if (!target) throw new AdminNotFoundError();

    if (target.isSuperAdmin && !actor.isSuperAdmin) throw new CannotModifySuperAdminError();
    if (input.roleId) {
      const role = await this.roles.findById(input.roleId);
      if (!role) throw new RoleNotFoundError();
      if (target.isSuperAdmin && role.name !== 'SUPER_ADMIN') {
        throw new SuperAdminRoleChangeError();
      }
    }
    if (actor.id === target.id && input.status === 'SUSPENDED') {
      throw new CannotSuspendSelfError();
    }

    const payload = {
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
    };

    const updated = await this.admins.updateAdmin(id, payload);
    recordAudit({
      action: 'admin.updated',
      actorId: actor.id,
      resource: `admin:${id}`,
      meta: { email: target.email, updatedBy: actor.email, fields: Object.keys(payload) },
    });
    logger.info(`[admin] ${actor.email} updated ${target.email}`);
    return this.getById(updated.id);
  }

  /** Hard-deletes an admin. Cannot delete self or other super admins unless actor is one. */
  async delete(actor: AdminActor, id: string): Promise<void> {
    if (actor.id === id) throw new CannotDeleteSelfError();
    const target = await this.admins.findById(id);
    if (!target) throw new AdminNotFoundError();
    if (target.isSuperAdmin && !actor.isSuperAdmin) throw new CannotModifySuperAdminError();

    await this.admins.hardDelete(id);
    await this.tokens.hardDeleteMany({ adminId: id });
    recordAudit({
      action: 'admin.deleted',
      actorId: actor.id,
      resource: `admin:${id}`,
      meta: { email: target.email, deletedBy: actor.email },
    });
    logger.info(`[admin] ${actor.email} deleted admin ${target.email}`);
  }
}

export type { Admin };
