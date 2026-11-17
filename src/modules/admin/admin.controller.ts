import type { NextFunction, Request, Response } from 'express';
import { AdminUsecases } from './admin.usecases';
import { AdminDashboardUsecases } from './admin.dashboard.usecases';
import { AdminSubscriberUsecases } from './admin.subscriber.usecases';
import { toAdminDto, toAdminListDto } from './admin.output';
import {
  toAdminSubscriberDto,
  toAdminSubscriberListDto,
  toAdminCampaignDto,
  toAdminCampaignListDto,
} from './admin.subscriber.output';
import { adminAuditContext } from '@/lib/audit/auditContext';
import type { AcceptInviteDto, InviteAdminDto, ListAdminsQuery, UpdateAdminDto } from './validation.schema';
import type {
  AdminCampaignListQuery,
  AdminSubscriberListQuery,
  BroadcastNewsletterDto,
  SetSubscriberStatusDto,
} from './admin.newsletter.validation';

export class AdminController {
  constructor(
    private readonly usecases: AdminUsecases = new AdminUsecases(),
    private readonly dashboard: AdminDashboardUsecases = new AdminDashboardUsecases(),
    private readonly subscribers: AdminSubscriberUsecases = new AdminSubscriberUsecases()
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req.query ?? {}) as unknown as ListAdminsQuery;
      const result = await this.usecases.list({
        page: query.page,
        perPage: query.perPage,
        search: query.search,
      });
      res.json({ success: true, data: toAdminListDto(result) });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const admin = await this.usecases.getById(req.params.id as string);
      res.json({ success: true, data: { admin: toAdminDto(admin) } });
    } catch (error) {
      next(error);
    }
  };

  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as InviteAdminDto;
      const admin = await this.usecases.invite(req.admin!, body);
      res.status(201).json({
        success: true,
        message: `Invitation sent to ${body.email}`,
        data: { admin: toAdminDto(admin) },
      });
    } catch (error) {
      next(error);
    }
  };

  /** Completes the email invitation. Public — no auth (invite token is the credential). */
  acceptInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      const body = req.body as AcceptInviteDto;
      const admin = await this.usecases.acceptInvite(token, body);
      res.json({ success: true, message: 'Invitation accepted — you can now sign in', data: { admin: toAdminDto(admin) } });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as UpdateAdminDto;
      const admin = await this.usecases.update(req.admin!, req.params.id as string, body);
      res.json({ success: true, data: { admin: toAdminDto(admin) } });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.usecases.delete(req.admin!, req.params.id as string);
      res.json({ success: true, message: 'Admin deleted' });
    } catch (error) {
      next(error);
    }
  };

  listSubscribers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req.query ?? {}) as unknown as AdminSubscriberListQuery;
      const result = await this.subscribers.list({
        page: query.page,
        perPage: query.perPage,
        search: query.search,
        status: query.status,
      });
      res.json({ success: true, data: toAdminSubscriberListDto(result) });
    } catch (error) {
      next(error);
    }
  };

  /** Full list for CSV export (client builds the file). */
  exportSubscribers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req.query ?? {}) as unknown as AdminSubscriberListQuery;
      const rows = await this.subscribers.exportAll(query.status);
      res.json({ success: true, data: { rows: rows.map(toAdminSubscriberDto), total: rows.length } });
    } catch (error) {
      next(error);
    }
  };

  setSubscriberStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as SetSubscriberStatusDto;
      const row = await this.subscribers.setStatus(
        adminAuditContext(req),
        req.params.id as string,
        body.status
      );
      res.json({ success: true, data: { subscriber: row ? toAdminSubscriberDto(row) : null } });
    } catch (error) {
      next(error);
    }
  };

  removeSubscriber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.subscribers.remove(adminAuditContext(req), req.params.id as string);
      res.json({ success: true, data: {} });
    } catch (error) {
      next(error);
    }
  };

  broadcastNewsletter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const campaign = await this.subscribers.broadcast(
        adminAuditContext(req),
        req.body as BroadcastNewsletterDto
      );
      res.status(201).json({ success: true, data: { campaign: toAdminCampaignDto(campaign) } });
    } catch (error) {
      next(error);
    }
  };

  listCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req.query ?? {}) as unknown as AdminCampaignListQuery;
      const result = await this.subscribers.listCampaigns({ page: query.page, perPage: query.perPage });
      res.json({ success: true, data: toAdminCampaignListDto(result) });
    } catch (error) {
      next(error);
    }
  };

  getCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const row = await this.subscribers.getCampaign(req.params.id as string);
      res.json({ success: true, data: { campaign: toAdminCampaignDto(row) } });
    } catch (error) {
      next(error);
    }
  };

  getDashboardSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.dashboard.summary();
      res.json({ success: true, data: { summary } });
    } catch (error) {
      next(error);
    }
  };
}
