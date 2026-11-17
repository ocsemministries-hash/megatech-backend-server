export type EnvOverrides = {
  PORT?: string;
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
  ADMIN_WEB_URL?: string;
  FRONTEND_WEB_URL?: string;
};

export type EnvExpectation = {
  PORT: number;
  NODE_ENV: string;
  CORS_ORIGIN: string[];
  ADMIN_WEB_URL: string;
  FRONTEND_WEB_URL: string;
};

export type EnvScenario = {
  name: string;
  overrides: EnvOverrides;
  expected: EnvExpectation;
};

const DEV_CORS = ['http://localhost:3000', 'http://localhost:5173'];

export const ENV_SCENARIOS: EnvScenario[] = [
  {
    name: 'falls back to defaults when no env vars are set',
    overrides: {},
    expected: {
      PORT: 5000,
      NODE_ENV: 'development',
      CORS_ORIGIN: DEV_CORS,
      ADMIN_WEB_URL: 'http://localhost:5173',
      FRONTEND_WEB_URL: 'http://localhost:3000',
    },
  },
  {
    name: 'falls back to default CORS origins when CORS_ORIGIN is blank',
    overrides: { CORS_ORIGIN: '' },
    expected: {
      PORT: 5000,
      NODE_ENV: 'development',
      CORS_ORIGIN: DEV_CORS,
      ADMIN_WEB_URL: 'http://localhost:5173',
      FRONTEND_WEB_URL: 'http://localhost:3000',
    },
  },
  {
    name: 'splits and trims a comma separated CORS_ORIGIN list',
    overrides: { CORS_ORIGIN: 'https://api.example.com, https://admin.example.com' },
    expected: {
      PORT: 5000,
      NODE_ENV: 'development',
      CORS_ORIGIN: ['https://api.example.com', 'https://admin.example.com'],
      ADMIN_WEB_URL: 'http://localhost:5173',
      FRONTEND_WEB_URL: 'http://localhost:3000',
    },
  },
  {
    name: 'honours explicit PORT and NODE_ENV values',
    overrides: { PORT: '8080', NODE_ENV: 'production' },
    expected: {
      PORT: 8080,
      NODE_ENV: 'production',
      CORS_ORIGIN: DEV_CORS,
      ADMIN_WEB_URL: 'http://localhost:5173',
      FRONTEND_WEB_URL: 'http://localhost:3000',
    },
  },
  {
    name: 'honours explicit frontend URLs',
    overrides: { ADMIN_WEB_URL: 'https://admin.megatech.org', FRONTEND_WEB_URL: 'https://app.megatech.org' },
    expected: {
      PORT: 5000,
      NODE_ENV: 'development',
      CORS_ORIGIN: DEV_CORS,
      ADMIN_WEB_URL: 'https://admin.megatech.org',
      FRONTEND_WEB_URL: 'https://app.megatech.org',
    },
  },
];
