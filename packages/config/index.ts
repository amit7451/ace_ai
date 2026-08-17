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
  // ── Core Server & Network ──
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  API_BASE_URL: z.string().url().default('http://localhost:3001'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // ── Security & Cryptography (Required) ──
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z
    .string()
    .min(32)
    .regex(
      /^[0-9a-fA-F]+$/,
      "ENCRYPTION_KEY must be a hex string (use: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
    ),
  OLD_ENCRYPTION_KEY: z.string().optional(),

  // ── Redis & Queue ──
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  WORKER_INGESTION_CONCURRENCY: z.string().default('5').transform(Number),
  WORKER_CRAWLER_CONCURRENCY: z.string().default('2').transform(Number),

  // ── Vector Database (Qdrant) ──
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),

  // ── Storage (AWS S3 / Cloudflare R2) ──
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('ion-ai-knowledge'),

  // ── Global System Free-Tier / Fallback AI Keys ──
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),

  // ── AI Model Defaults ──
  LLM_PROVIDER: z.string().default('gemini'),
  LLM_MODEL: z.string().default('gemini-1.5-flash'),
  EMBEDDING_PROVIDER: z.string().default('gemini'),
  EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),

  // ── Cost Controls, Quotas & Rate Limits ──
  MAX_MESSAGE_CHARACTERS: z.string().default('4000').transform(Number),
  DAILY_FREE_TIER_REQUEST_LIMIT: z.string().default('100').transform(Number),
  GLOBAL_SHARED_KEY_RPM_LIMIT: z.string().default('2000').transform(Number),
  ORGANIZATION_FREE_TIER_RPM_LIMIT: z.string().default('500').transform(Number),
  VISITOR_RPM_LIMIT: z.string().default('20').transform(Number),
  WIDGET_RPM_LIMIT: z.string().default('100').transform(Number),
  MAX_FREE_TIER_OUTPUT_TOKENS: z.string().default('1024').transform(Number),
  MAX_FREE_TIER_TOP_K: z.string().default('5').transform(Number),
  MAX_CONTEXT_TOKENS: z.string().default('4096').transform(Number),
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
