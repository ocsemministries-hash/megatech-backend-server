import type { CookieOptions, Request, Response } from 'express';
import { ENV } from '@/config/env';

// Distinct pairs per audience so partner + admin sessions never overwrite each other.
export const ADMIN_ACCESS_COOKIE = 'megatech_aa_access';
export const ADMIN_REFRESH_COOKIE = 'megatech_aa_refresh';
export const USER_ACCESS_COOKIE = 'megatech_pa_access';
export const USER_REFRESH_COOKIE = 'megatech_pa_refresh';

/** @deprecated Use ADMIN_* / USER_* pairs. Kept for one release to clear legacy cookies. */
export const ACCESS_COOKIE = 'megatech_access';
/** @deprecated Use ADMIN_* / USER_* pairs. Kept for one release to clear legacy cookies. */
export const REFRESH_COOKIE = 'megatech_refresh';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const refreshMaxAgeMs = (): number => ENV.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

const normaliseDomain = (domain: string): string => domain.trim().replace(/^\./, '').toLowerCase();

/**
 * `Domain` attribute for this request. Browsers reject a cookie whose Domain
 * the request host is not part of (e.g. `Domain=megatech.org` from `localhost`),
 * so COOKIE_DOMAIN only applies when the API host is that domain or one of its
 * subdomains. Otherwise the cookie is host-only, which is what local dev needs
 * and what is recommended everywhere (see `.env.example`).
 */
export const resolveCookieDomain = (hostname: string | undefined, configured: string | undefined = ENV.COOKIE_DOMAIN): string | undefined => {
  if (!configured || !hostname) return undefined;
  const domain = normaliseDomain(configured);
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`) ? domain : undefined;
};

/**
 * `Secure` attribute for this request. Production keeps the configured value
 * (default on). Elsewhere it follows the actual protocol (`req.secure` honours
 * `trust proxy`): https staging gets Secure cookies, plain-http localhost does not.
 */
export const resolveCookieSecure = (req: Pick<Request, 'secure'> | undefined): boolean =>
  ENV.NODE_ENV === 'production' ? ENV.COOKIE_SECURE : Boolean(req?.secure);

/** Attributes shared by set + clear (a cookie is only cleared when name, domain and path match). */
const scopeFor = (res: Response): Pick<CookieOptions, 'domain' | 'path' | 'secure' | 'sameSite' | 'httpOnly'> => ({
  httpOnly: true,
  // Lax works because every frontend and its API are same-site (localhost:* locally, *.megatech.org deployed).
  sameSite: 'lax',
  path: '/',
  secure: resolveCookieSecure(res.req),
  domain: resolveCookieDomain(res.req?.hostname),
});

const setPair = (res: Response, names: [string, string], accessToken: string, refreshToken: string): void => {
  const scope = scopeFor(res);
  res.cookie(names[0], accessToken, { ...scope, maxAge: ACCESS_MAX_AGE_MS });
  res.cookie(names[1], refreshToken, { ...scope, maxAge: refreshMaxAgeMs() });
};

/**
 * Expires cookies both host-only and on the configured domain, so sign-out
 * also removes cookies written by an older Domain-scoped configuration.
 */
const clearAll = (res: Response, names: string[]): void => {
  const scope = scopeFor(res);
  const legacyDomain = ENV.COOKIE_DOMAIN ? normaliseDomain(ENV.COOKIE_DOMAIN) : undefined;
  const domainVariants = new Set<string | undefined>([scope.domain, undefined]);
  if (legacyDomain && resolveCookieDomain(res.req?.hostname, legacyDomain)) domainVariants.add(legacyDomain);
  for (const name of names) {
    for (const domain of domainVariants) res.clearCookie(name, { ...scope, domain });
  }
};

export const setAdminAuthCookies = (res: Response, accessToken: string, refreshToken: string): void =>
  setPair(res, [ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE], accessToken, refreshToken);

export const clearAdminAuthCookies = (res: Response): void =>
  clearAll(res, [ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, ACCESS_COOKIE, REFRESH_COOKIE]);

export const setUserAuthCookies = (res: Response, accessToken: string, refreshToken: string): void =>
  setPair(res, [USER_ACCESS_COOKIE, USER_REFRESH_COOKIE], accessToken, refreshToken);

export const clearUserAuthCookies = (res: Response): void => clearAll(res, [USER_ACCESS_COOKIE, USER_REFRESH_COOKIE]);
