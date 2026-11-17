import { OAuth2Client } from 'google-auth-library';
import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';

export interface VerifiedGoogleProfile {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

let client: OAuth2Client | null = null;

const getClient = (): OAuth2Client => {
  if (!client) client = new OAuth2Client();
  return client;
};

/**
 * Verifies a Google Identity Services ID token and returns the profile.
 * Throws when GOOGLE_CLIENT_ID is unset or verification fails.
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<VerifiedGoogleProfile> => {
  if (!ENV.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }
  try {
    const ticket = await getClient().verifyIdToken({
      idToken,
      audience: ENV.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new Error('Google token payload missing sub/email');
    }
    const [firstName = '', ...rest] = (payload.given_name ?? payload.name ?? '').split(' ');
    return {
      googleSub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      firstName,
      lastName: payload.family_name ?? rest.join(' '),
    };
  } catch (error) {
    logger.warn('[google] ID token verification failed');
    throw error;
  }
};
