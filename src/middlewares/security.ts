import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { Express } from 'express';
import { ENV } from '@/config/env.js';

export const configureSecurityMiddleware = (app: Express) => {
  // 0. Trust reverse proxy headers (Render, Railway, Nginx, Cloudflare)
  // Value of 1 trusts the first hop/proxy layer
  app.set('trust proxy', 1);

  // 1. Secure HTTP Headers
  app.use(helmet());

  // 2. Strict CORS Configuration
  app.use(cors({
    origin: ENV.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // 3. HTTP Parameter Pollution Protection
  app.use(hpp());

  // 4. Rate Limiting (100 requests per 15 minutes)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, message: 'Too many requests, please try again later.' },
  });
  app.use('/api', limiter);
};