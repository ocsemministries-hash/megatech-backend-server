import express from 'express';
import type { Request } from 'express';
import cookieParser from 'cookie-parser';
import { configureSecurityMiddleware } from '@/middlewares/security.js';
import { errorHandler } from '@/middlewares/errorHandler.js';
import { swaggerSpec } from './doc/swagger';
import swaggerUi from 'swagger-ui-express';
import { authRouter } from '@/modules/auth/auth.route';
import { userAuthRouter } from '@/modules/userAuth/userAuth.route';
import { adminRouter } from '@/modules/admin/admin.route';
import { rbacRouter } from '@/modules/rbac/rbac.route';
import { paymentsRouter } from '@/modules/payments/payments.route';
import { newsletterRouter } from '@/modules/newsletter/newsletter.route';
import { initializeEventListeners } from '@/lib/events';

const app = express();

// Initialize all background event listeners before any route can emit
// (emitting with no listener silently drops the side effect).
initializeEventListeners();

// Standard Middlewares
app.use(express.json({
  limit: '10kb',
  verify: (req, _res, buffer) => { (req as Request).rawBody = Buffer.from(buffer); },
})); // Raw bytes also allow verification of signed provider webhooks.
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security Middlewares
configureSecurityMiddleware(app);

app.get('/', (_req, res) => {
  res.json({ success: true, name: 'Megatech Backend API', version: '1.0.0', docs: '/docs' });
});

// Serve Swagger UI Route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs-json', (_req, res) => {
  res.json(swaggerSpec);
});

// Modular Routes Routing
app.use('/api/v1/auth', userAuthRouter());
app.use('/api/v1/admin/auth', authRouter());
app.use('/api/v1/admin', adminRouter());
app.use('/api/v1/admin', rbacRouter());
app.use('/api/v1/payments', paymentsRouter());
app.use('/api/v1/newsletter', newsletterRouter());

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

// Global Error Handler
app.use(errorHandler);

export default app;
