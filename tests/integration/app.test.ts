import { describe, expect, it } from 'vitest';
import {
  ALLOWED_ORIGIN,
  CORS_HEADER,
  DISALLOWED_ORIGIN,
  HELMET_SECURITY_HEADERS,
  ROUTES,
} from '../fixtures/http.fixtures';
import { api } from '../helpers/request';

describe('HTTP application (integration)', () => {
  it('serves the Swagger UI documentation page at /docs', async () => {
    const response = await api.get(ROUTES.swaggerDocs).redirects(1);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toContain('swagger-ui');
  });

  it('applies Helmet security headers to every response', async () => {
    const response = await api.get(ROUTES.swaggerDocs);

    for (const [header, value] of Object.entries(HELMET_SECURITY_HEADERS)) {
      expect(response.headers[header]).toBe(value);
    }
  });

  it('sets the CORS header for requests from an allowed origin', async () => {
    const response = await api.get(ROUTES.swaggerDocs).set('Origin', ALLOWED_ORIGIN);

    expect(response.headers[CORS_HEADER]).toBe(ALLOWED_ORIGIN);
  });

  it('omits the CORS header for requests from a disallowed origin', async () => {
    const response = await api.get(ROUTES.swaggerDocs).set('Origin', DISALLOWED_ORIGIN);

    expect(response.headers[CORS_HEADER]).toBeUndefined();
  });

  it('returns 404 for unknown routes', async () => {
    const response = await api.get(ROUTES.missing);

    expect(response.status).toBe(404);
  });

  it('accepts and parses a JSON request body', async () => {
    const response = await api.post(ROUTES.missing).send({ hello: 'world' });

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/json|text/);
  });
});
