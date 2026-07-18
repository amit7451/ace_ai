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
      { res: { statusCode: reply.statusCode }, responseTime: reply.getResponseTime() },
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

server.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

server.register(import('./plugins/auth'));
server.register(import('./plugins/org-context'));

// API Routes
server.register(
  async (api) => {
    api.register(authController, { prefix: '/auth' });
    api.register(organizationController, { prefix: '/organizations' });
    api.register(memberController, { prefix: '/organizations/:id/members' });
    api.register(auditLogController, { prefix: '/organizations/:id/audit-logs' });
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
  request.log.error({ err: error }, 'Request error');

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

  // Custom application errors can be caught here and mapped to codes

  return reply.status(error.statusCode || 500).send({
    success: false,
    error: {
      code:
        error.statusCode === 401
          ? 'UNAUTHORIZED'
          : error.statusCode === 403
            ? 'FORBIDDEN'
            : error.statusCode === 404
              ? 'NOT_FOUND'
              : 'INTERNAL_SERVER_ERROR',
      message: error.statusCode ? error.message : 'An unexpected error occurred',
    },
  });
});

// Health Endpoints
server.get('/health', async () => ({ status: 'ok' }));
server.get('/ready', async () => ({ status: 'ready' }));

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
