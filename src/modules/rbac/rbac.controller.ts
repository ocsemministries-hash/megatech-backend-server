import type { NextFunction, Request, Response } from 'express';
import { RbacUsecases } from './rbac.usecases';
import { toResourcesDto, toRoleDto, toRoleListDto } from './rbac.output';
import type { UpdateRolePermissionsDto } from './validation.schema';

export class RbacController {
  constructor(private readonly usecases: RbacUsecases = new RbacUsecases()) {}

  resources = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.usecases.resources();
      res.json({ success: true, data: toResourcesDto(result) });
    } catch (error) {
      next(error);
    }
  };

  listRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.usecases.listRoles();
      res.json({ success: true, data: toRoleListDto(result) });
    } catch (error) {
      next(error);
    }
  };

  getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = await this.usecases.getRole(req.params.id as string);
      res.json({ success: true, data: { role: toRoleDto(role) } });
    } catch (error) {
      next(error);
    }
  };

  updateRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as UpdateRolePermissionsDto;
      const role = await this.usecases.updateRolePermissions(req.params.id as string, body);
      res.json({ success: true, data: { role: toRoleDto(role) } });
    } catch (error) {
      next(error);
    }
  };

  deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.usecases.deleteRole(req.params.id as string);
      res.json({ success: true, message: 'Role deleted' });
    } catch (error) {
      next(error);
    }
  };
}
