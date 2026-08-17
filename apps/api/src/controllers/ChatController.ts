import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  chatService,
  conversationService,
  widgetService,
  rateLimitService,
  LLMError,
  LLMRateLimitError,
} from '@ion-ai/chat';
import { env } from '@ion-ai/config';
import crypto from 'crypto';

export const ChatController: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request, reply) => {
    const schema = z.object({
      widgetKey: z.string().max(128).optional(),
      conversationId: z.string().max(128).optional(),
      message: z
        .string({ required_error: 'Message is required' })
        .trim()
        .min(1, 'Message cannot be empty')
        .max(
          env.MAX_MESSAGE_CHARACTERS,
          `Message exceeds the maximum limit of ${env.MAX_MESSAGE_CHARACTERS.toLocaleString()} characters. Please shorten your query and try again.`
        ),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      const firstErrorMessage = parsed.error.errors[0]?.message || 'Invalid request payload';
      return reply.status(400).send({
        success: false,
        error: firstErrorMessage,
        details: parsed.error.format(),
      });
    }

    const { widgetKey, message } = parsed.data;
    let { conversationId } = parsed.data;

    let organizationId = '';
    let deploymentId = '';
    const isWidget = !!widgetKey;

    const visitorIp = request.ip || '0.0.0.0';
    const ipHash = crypto.createHash('sha256').update(visitorIp).digest('hex');
    const userAgent = request.headers['user-agent'] || 'unknown';

    let isStreaming = false;

    try {
      if (widgetKey) {
        // Widget Flow
        const widget = await widgetService.validateWidgetKey(widgetKey, request.headers.origin);
        organizationId = widget.deployment.organizationId;
        deploymentId = widget.deploymentId;
        await rateLimitService.checkWidgetLimit(widget.id);
      } else {
        // Playground Flow (Authenticated)
        await request.jwtVerify({ onlyCookie: true });
        const orgIdHeader = request.headers['x-organization-id'] as string;
        if (!orgIdHeader)
          return reply.status(400).send({ success: false, error: 'Missing x-organization-id' });

        organizationId = orgIdHeader;
        try {
          await chatService.validatePlaygroundAccess((request.user as any).id, organizationId);
        } catch (e) {
          return reply
            .status(401)
            .send({ success: false, error: 'Unauthorized for this organization' });
        }
      }

      await rateLimitService.checkVisitorLimit(ipHash);
      await rateLimitService.checkOrganizationLimit(organizationId);

      // Get or Create Conversation
      if (conversationId) {
        // SECURITY: Verify the client-supplied conversationId belongs to this tenant.
        // Responds 404 (not 403) to avoid confirming whether the ID exists.
        const existingConv = await conversationService.verifyOwnership(
          conversationId,
          organizationId,
          isWidget ? deploymentId : undefined
        );
        if (!existingConv) {
          return reply.status(404).send({ success: false, error: 'Conversation not found' });
        }
      } else {
        const visitor = await chatService.getOrCreateVisitorSession(
          organizationId,
          ipHash,
          userAgent
        );

        const conv = await conversationService.createConversation(
          organizationId,
          deploymentId || undefined,
          visitor.id
        );
        conversationId = conv.id;
      }

      // SSE setup
      isStreaming = true;
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      if (isWidget) {
        reply.raw.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
      } else {
        const origin = request.headers.origin;
        if (origin && origin === env.FRONTEND_URL) {
          reply.raw.setHeader('Access-Control-Allow-Origin', env.FRONTEND_URL);
          reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
          reply.raw.setHeader('Vary', 'Origin');
        }
      }

      const chatResult = await chatService.streamChat(
        organizationId,
        conversationId,
        message,
        widgetKey ? 'widget' : 'playground'
      );
      const stream = chatResult.stream;
      const welcomeMessage = chatResult.welcomeMessage;

      // Send metadata event
      reply.raw.write(
        `data: ${JSON.stringify({
          type: 'metadata',
          conversationId,
          welcomeMessage,
          institutionSupport: chatResult.institutionSupport,
        })}\n\n`
      );

      let isClientDisconnected = false;
      const onDisconnect = () => {
        if (!reply.raw.writableEnded) {
          isClientDisconnected = true;
        }
      };
      reply.raw.on('close', onDisconnect);

      try {
        for await (const chunk of stream) {
          if (isClientDisconnected || reply.raw.destroyed || reply.raw.closed) {
            break;
          }
          reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      } finally {
        reply.raw.off('close', onDisconnect);
        if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
      }
    } catch (err: any) {
      const institutionSupport = organizationId
        ? await chatService.getInstitutionDetails(organizationId).catch(() => ({}))
        : {};

      let structuredError: any;

      if (err instanceof LLMError) {
        structuredError = err.toStructuredAIError({
          clientContext: isWidget ? 'widget' : 'playground',
          institutionSupport,
        });
      } else if (err.statusCode === 429) {
        const keySource = err.keySource || 'SYSTEM_FREE_TIER';
        const rateErr = new LLMRateLimitError({
          provider: 'system',
          keySource,
          retryAfterMs: err.retryAfterMs || 60000,
          institutionSupport,
        });
        structuredError = rateErr.toStructuredAIError({
          clientContext: isWidget ? 'widget' : 'playground',
          keySource,
          institutionSupport,
        });
      } else {
        structuredError = {
          code: 'CHAT_ERROR',
          category: 'UNKNOWN',
          message: err.message || 'An unexpected error occurred during chat stream.',
          keySource: 'SYSTEM_FREE_TIER',
          provider: 'system',
          institutionSupport,
          actionableResolution: {
            type: 'RETRY_NOW',
            title: 'Request Failed',
            description: err.message || 'An unexpected error occurred.',
            primaryButton: {
              label: 'Retry',
              action: 'RETRY_NOW',
            },
          },
        };
      }

      if (!isStreaming) {
        return reply.status(err.statusCode || 500).send({
          success: false,
          error: structuredError,
        });
      } else {
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: structuredError })}\n\n`);
      }
    } finally {
      if (isStreaming) {
        reply.raw.end();
      }
    }

    if (isStreaming) {
      return reply;
    }
  });

  fastify.get('/config', async (request, reply) => {
    const { widgetKey } = request.query as { widgetKey?: string };
    if (!widgetKey) {
      return reply.status(400).send({ success: false, error: 'Missing widgetKey' });
    }

    try {
      const widget = await widgetService.validateWidgetKey(widgetKey, request.headers.origin);
      const orgId = widget.deployment.organizationId;
      const welcomeMessage = await chatService.getWelcomeMessage(orgId);
      const institutionDetails = await chatService.getInstitutionDetails(orgId);

      return reply.send({
        success: true,
        data: {
          welcomeMessage,
          institutionName:
            institutionDetails.institutionName ||
            widget.deployment.organization?.name ||
            'Institution Support',
          supportEmail: institutionDetails.supportEmail,
          supportWebsite: institutionDetails.supportWebsite,
          supportPhone: institutionDetails.supportPhone,
          introductoryMessage: institutionDetails.introductoryMessage || welcomeMessage,
        },
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });
};
