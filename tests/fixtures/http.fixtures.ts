export const ALLOWED_ORIGIN = 'http://localhost:3000';
export const DISALLOWED_ORIGIN = 'https://malicious.example.com';

export const ROUTES = {
  swaggerDocs: '/docs',
  missing: '/api/v1/does-not-exist',
} as const;

export const HELMET_SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'x-dns-prefetch-control': 'off',
  'x-download-options': 'noopen',
  'x-permitted-cross-domain-policies': 'none',
};

export const CORS_HEADER = 'access-control-allow-origin';
