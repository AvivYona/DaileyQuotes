import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthProvider } from '../schemas/user.schema';

type VerifiedProfile = {
  providerUserId: string;
  email?: string;
  fullName?: string;
};

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const APPLE_ISSUER = 'https://appleid.apple.com';

const googleJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
const appleJwks = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

const parseEnvList = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const getGoogleAudiences = (): string[] => {
  const audiences = parseEnvList(process.env.GOOGLE_CLIENT_IDS);
  if (!audiences.length) {
    throw new Error(
      'Missing GOOGLE_CLIENT_IDS environment variable for google auth validation',
    );
  }
  return audiences;
};

const getAppleAudiences = (): string[] => {
  const audiences = parseEnvList(process.env.APPLE_CLIENT_IDS);
  if (!audiences.length) {
    throw new Error(
      'Missing APPLE_CLIENT_IDS environment variable for apple auth validation',
    );
  }
  return audiences;
};

const verifyGoogleToken = async (token: string): Promise<VerifiedProfile> => {
  try {
    const { payload } = await jwtVerify(token, googleJwks, {
      issuer: GOOGLE_ISSUERS,
      audience: getGoogleAudiences(),
    });

    if (typeof payload.sub !== 'string') {
      throw new Error('Missing google subject');
    }

    return {
      providerUserId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      fullName: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch (error) {
    console.error('Failed to verify google identity token', error);
    throw new Error('UNAUTHORIZED');
  }
};

const verifyAppleToken = async (token: string): Promise<VerifiedProfile> => {
  try {
    const { payload } = await jwtVerify(token, appleJwks, {
      issuer: APPLE_ISSUER,
      audience: getAppleAudiences(),
    });

    if (typeof payload.sub !== 'string') {
      throw new Error('Missing apple subject');
    }

    return {
      providerUserId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch (error) {
    console.error('Failed to verify apple identity token', error);
    throw new Error('UNAUTHORIZED');
  }
};

export const verifyIdentityToken = async (
  provider: AuthProvider,
  token: string,
): Promise<VerifiedProfile> => {
  if (provider === 'google') {
    return verifyGoogleToken(token);
  }

  return verifyAppleToken(token);
};
