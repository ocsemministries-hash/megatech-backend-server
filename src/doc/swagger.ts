import { authDefinitions } from '../modules/auth/doc/auth.definitions.js';
import { authDocs } from '../modules/auth/doc/auth.docs.js';
import { userAuthDefinitions } from '../modules/userAuth/doc/userAuth.definitions.js';
import { userAuthDocs } from '../modules/userAuth/doc/userAuth.docs.js';
import { adminDefinitions } from '../modules/admin/doc/admin.definitions.js';
import { adminDocs } from '../modules/admin/doc/admin.docs.js';
import { rbacDefinitions } from '../modules/rbac/doc/rbac.definitions.js';
import { rbacDocs } from '../modules/rbac/doc/rbac.docs.js';

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Megatech Backend API',
    version: '1.0.0',
    description: 'Modular API documentation for the Megatech backend',
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Development Server',
    },
  ],
  tags: [
    { name: 'Admin Auth', description: 'Admin authentication: register, login, MFA OTP, refresh, logout' },
    { name: 'Partner Auth', description: 'Partner (public user) authentication: register, login, MFA OTP, Google, refresh, logout' },
    { name: 'Admins', description: 'Admin management: list, invite, update, delete' },
    { name: 'RBAC', description: 'Roles, permissions and the resource registry' },
    { name: 'Newsletter', description: 'Subscribers and admin broadcast campaigns' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ...authDefinitions,
      ...userAuthDefinitions,
      ...adminDefinitions,
      ...rbacDefinitions,
    },
  },
  paths: {
    ...authDocs,
    ...userAuthDocs,
    ...adminDocs,
    ...rbacDocs,
  },
};
