import { z } from 'zod';
import { config } from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Automatically locate and load .env files across monorepo workspace hierarchy
function loadEnvironment() {
  const visited = new Set<string>();

  // 1. Current working directory
  const cwdEnv = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(cwdEnv)) {
    config({ path: cwdEnv });
    visited.add(cwdEnv);
  }

  // 2. Search upward from process.cwd() and __dirname for root .env / .env.local
  const startPaths = [process.cwd(), __dirname];
  for (const startPath of startPaths) {
    let currentDir = startPath;
    while (currentDir && currentDir !== path.dirname(currentDir)) {
      const candidatePaths = [path.join(currentDir, '.env'), path.join(currentDir, '.env.local')];

      for (const candidate of candidatePaths) {
        if (!visited.has(candidate) && fs.existsSync(candidate)) {
          config({ path: candidate });
          visited.add(candidate);
        }
      }

      if (
        fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml')) ||
        fs.existsSync(path.join(currentDir, 'turbo.json')) ||
        fs.existsSync(path.join(currentDir, '.git'))
      ) {
        break;
      }
      currentDir = path.dirname(currentDir);
    }
  }
}

loadEnvironment();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z
    .string()
    .min(32)
    .regex(
      /^[0-9a-fA-F]+$/,
      "ENCRYPTION_KEY must be a hex string (use: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
    ),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Storage (Cloudflare R2)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('ion-ai-knowledge'),

  // Queue & DB (Redis / Qdrant)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  QDRANT_URL: z.string().default('http://localhost:6333'),

  // AI Providers
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

const ALGORITHM = 'aes-256-gcm';

export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(env.ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptApiKey(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(env.ENCRYPTION_KEY.slice(0, 32)),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
