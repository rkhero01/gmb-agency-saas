import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from backend root if it exists
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  APP_NAME: process.env.APP_NAME || 'gmb-agency-saas-api',
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: parseInt(process.env.DB_PORT, 10) || 5432,
    NAME: process.env.DB_NAME || 'gmb_agency_saas_dev',
    USER: process.env.DB_USER || 'postgres',
    PASSWORD: process.env.DB_PASSWORD || '',
    SSL: process.env.DB_SSL === 'true',
    URL: process.env.DATABASE_URL || null,
  },
  JWT: {
    SECRET: process.env.JWT_SECRET || 'dev_secret_replace_in_production',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  },
  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/google/callback',
    SCOPES: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/business.manage',
    ],
  },
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};
