import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const isProd = process.env.NODE_ENV === 'production';

// Values that must never be accepted in production (the old dev fallbacks and
// the placeholders shipped in .env.example).
const INSECURE_SECRET_PATTERN =
  /(change[-_ ]?me|change[-_ ]?in[-_ ]?production|your[-_ ]|dev-secret|dev-refresh-secret|^cookie-secret$|placeholder)/i;

/**
 * Read an env var. In production a missing value aborts startup with a clear
 * message instead of silently falling back to an insecure default.
 */
function requireInProd(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim() !== '') return value;
  if (isProd) {
    throw new Error(
      `[config] Missing required environment variable ${name}. ` +
        `Refusing to start in production without it.`
    );
  }
  return devFallback;
}

/** Same as requireInProd, but also rejects weak/placeholder secrets in production. */
function requireSecretInProd(name: string, devFallback: string): string {
  const value = requireInProd(name, devFallback);
  if (isProd && (value.length < 32 || INSECURE_SECRET_PATTERN.test(value))) {
    throw new Error(
      `[config] ${name} is too short (<32 chars) or looks like a placeholder. ` +
        `Generate a long random value (e.g. \`openssl rand -base64 48\`).`
    );
  }
  return value;
}

const jwtSecret = requireSecretInProd('JWT_SECRET', 'dev-secret-change-me');
const jwtRefreshSecret = requireSecretInProd('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me');
if (isProd && jwtSecret === jwtRefreshSecret) {
  throw new Error('[config] JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
}

// Express treats a NaN hop count as "trust no proxy", which silently breaks client-IP
// detection and rate limiting, so reject anything that is not a non-negative integer.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || '1');
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error('[config] TRUST_PROXY_HOPS must be a non-negative integer (e.g. 1).');
}

// CLIENT_URL may list several comma-separated origins (e.g. production + a custom domain).
const clientUrl = requireInProd('CLIENT_URL', 'http://localhost:3000');
const clientUrls = clientUrl.split(',').map((origin) => origin.trim()).filter(Boolean);
if (isProd && (clientUrls.length === 0 || clientUrls.some((origin) => !/^https?:\/\/[^/\s]+$/i.test(origin)))) {
  throw new Error(
    '[config] CLIENT_URL must be one or more http(s) origins without a path or trailing slash, separated by commas.'
  );
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd,
  app: {
    name: process.env.APP_NAME || 'Nexus Commerce',
    port: parseInt(process.env.PORT || '4000', 10),
    apiUrl: process.env.API_URL || 'http://localhost:4000',
    // The first origin is the primary one: it is used to build links in e-mails.
    clientUrl: clientUrls[0] ?? clientUrl,
    clientUrls,
    // Number of reverse proxies in front of the API (used for client-IP detection / rate limiting).
    trustProxyHops,
  },
  db: {
    url: requireInProd('DATABASE_URL', 'mysql://root@localhost:3306/nexus_commerce'),
  },
  jwt: {
    secret: jwtSecret,
    refreshSecret: jwtRefreshSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cookie: {
    secret: requireSecretInProd('COOKIE_SECRET', 'cookie-secret'),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@nexuscommerce.io',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
} as const;
