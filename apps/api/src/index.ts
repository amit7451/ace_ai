import fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { env } from '@ion-ai/config';
import { logger } from '@ion-ai/logger';
import { ErrorResponseSchema } from '@ion-ai/contracts';
import { ZodError } from 'zod';

import { FastifyInstance } from 'fastify';

const server = fastify({
  logger: logger,
  disableRequestLogging: true,
  genReqId: () => crypto.randomUUID(),
}) as unknown as FastifyInstance;

server.addHook('onRequest', (req, reply, done) => {
  if (req.method !== 'OPTIONS' && !req.url.startsWith('/api/v1/jobs/stream')) {
    req.log.info({ req: { method: req.method, url: req.url } }, 'incoming request');
  }
  done();
});

server.addHook('onResponse', (req, reply, done) => {
  if (req.method !== 'OPTIONS' && !req.url.startsWith('/api/v1/jobs/stream')) {
    req.log.info(
      { res: { statusCode: reply.statusCode }, responseTime: reply.elapsedTime },
      'request completed'
    );
  }
  done();
});

import { authController } from './controllers/AuthController';
import { organizationController } from './controllers/OrganizationController';
import { memberController } from './controllers/MemberController';
import { configurationController } from './controllers/ConfigurationController';
import { knowledgeController } from './controllers/KnowledgeController';
import { crawlerController } from './controllers/CrawlerController';
import { jobController } from './controllers/JobController';
import { ChatController } from './controllers/ChatController';
import { WidgetController } from './controllers/WidgetController';
import { ConversationController } from './controllers/ConversationController';

import rateLimit from '@fastify/rate-limit';
import { auditLogController } from './controllers/AuditLogController';

// Plugins
server.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
});

server.register(cookie, {
  secret: env.JWT_SECRET,
  hook: 'onRequest',
});

server.register(rateLimit, {
  global: false,
  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
  }),
});

server.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit matching business rule
  },
});

server.register(import('./plugins/auth'));
server.register(import('./plugins/org-context'));

// API Routes
server.register(
  async (api) => {
    api.register(authController, { prefix: '/auth' });
    api.register(organizationController, { prefix: '/organizations' });
    api.register(memberController, { prefix: '/organizations/:orgId/members' });
    api.register(auditLogController, { prefix: '/organizations/:orgId/audit-logs' });
    api.register(configurationController, { prefix: '/configuration' });
    api.register(knowledgeController, { prefix: '/knowledge' });
    api.register(crawlerController, { prefix: '/crawlers' });
    api.register(jobController, { prefix: '/jobs' });
    api.register(ChatController, { prefix: '/chat' });
    api.register(WidgetController, { prefix: '/widgets' });
    api.register(ConversationController, { prefix: '/conversations' });
  },
  { prefix: '/api/v1' }
);

// Global Error Handler
server.setErrorHandler((error, request, reply) => {
  const statusCode = (error as any).statusCode || 500;
  if (statusCode >= 500) {
    request.log.error({ err: error }, 'Server error');
  } else {
    request.log.warn(
      { statusCode, message: error.message, url: request.url },
      'Client request error'
    );
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors,
      },
    });
  }

  if (typeof (error as any).toStructuredAIError === 'function') {
    const structured = (error as any).toStructuredAIError();
    return reply.status((error as any).statusCode || 400).send({
      success: false,
      error: structured,
    });
  }

  return reply.status((error as any).statusCode || 500).send({
    success: false,
    error: {
      code:
        (error as any).statusCode === 401
          ? 'UNAUTHORIZED'
          : (error as any).statusCode === 403
            ? 'FORBIDDEN'
            : (error as any).statusCode === 404
              ? 'NOT_FOUND'
              : (error as any).statusCode === 429
                ? 'RATE_LIMIT_EXCEEDED'
                : 'INTERNAL_SERVER_ERROR',
      message: (error as any).statusCode ? error.message : 'An unexpected error occurred',
    },
  });
});

// Health & Readiness Endpoints
server.get('/health', async () => ({ status: 'ok' }));

server.get('/ready', async (request, reply) => {
  try {
    const { prisma } = await import('@ion-ai/database');
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', database: 'connected' };
  } catch (err: any) {
    reply.status(503);
    return { status: 'unhealthy', database: 'disconnected', error: err.message };
  }
});

// Start server
const start = async () => {
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`Server listening on port ${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

export { server };
