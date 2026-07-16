import { UserRepository } from './repositories/UserRepository';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { MemberRepository } from './repositories/MemberRepository';
import { ConfigurationRepository } from './repositories/ConfigurationRepository';
import { AuditLogRepository } from './repositories/AuditLogRepository';
import { KnowledgeRepository } from './repositories/KnowledgeRepository';
import { CrawlerRepository } from './repositories/CrawlerRepository';
import { JobRepository } from './repositories/JobRepository';
import { R2StorageProvider } from '@ion-ai/storage';
import { BullMQProvider } from '@ion-ai/queue';

import { AuthService } from './services/AuthService';
import { OrganizationService } from './services/OrganizationService';
import { MemberService } from './services/MemberService';
import { ConfigurationService } from './services/ConfigurationService';
import { KnowledgeService } from './services/KnowledgeService';
import { CrawlerService } from './services/CrawlerService';
import { JobService } from './services/JobService';

import { env } from '@ion-ai/config';

// Repositories
export const userRepository = new UserRepository();
export const organizationRepository = new OrganizationRepository();
export const memberRepository = new MemberRepository();
export const configurationRepository = new ConfigurationRepository();
export const auditLogRepository = new AuditLogRepository();
export const knowledgeRepository = new KnowledgeRepository();
export const crawlerRepository = new CrawlerRepository();
export const jobRepository = new JobRepository();

// Providers
export const storageProvider = new R2StorageProvider({
  accountId: env.R2_ACCOUNT_ID ?? '',
  accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
  bucketName: env.R2_BUCKET_NAME ?? 'ion-ai-knowledge',
});

export const queueProvider = new BullMQProvider({
  host: env.REDIS_HOST ?? 'localhost',
  port: env.REDIS_PORT ? parseInt(env.REDIS_PORT) : 6379,
  password: env.REDIS_PASSWORD,
});

// Services
export const organizationService = new OrganizationService(
  organizationRepository,
  memberRepository,
  configurationRepository,
  auditLogRepository
);
export const authService = new AuthService(userRepository, organizationService);
export const memberService = new MemberService(memberRepository, auditLogRepository);
export const configurationService = new ConfigurationService(
  configurationRepository,
  auditLogRepository
);
export const knowledgeService = new KnowledgeService(
  storageProvider,
  queueProvider,
  auditLogRepository,
  knowledgeRepository,
  jobRepository
);
export const crawlerService = new CrawlerService(
  crawlerRepository,
  queueProvider,
  auditLogRepository
);
export const jobService = new JobService(jobRepository, knowledgeRepository, queueProvider);
