import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { ENV } from '../config/env.js';

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, { stack: err.stack, path: req.path });

  const statusCode = err.statusCode || 500;
  const message = ENV.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};