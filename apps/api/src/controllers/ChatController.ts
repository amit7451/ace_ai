import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { chatService, conversationService, widgetService, rateLimitService } from '@ion-ai/chat';
import crypto from 'crypto';
import { prisma } from '@ion-ai/database';

export const ChatController: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request, reply) => {
    const schema = z.object({
      widgetKey: z.string().optional(),
      conversationId: z.string().optional(),
      message: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'Invalid input' });
    }

    const { widgetKey, message } = parsed.data;
    let { conversationId } = parsed.data;

    let organizationId = '';
    let deploymentId = '';

    // Auth & Rate Limiting
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
        await request.jwtVerify();
        const orgIdHeader = request.headers['x-organization-id'] as string;
        if (!orgIdHeader)
          return reply.status(400).send({ success: false, error: 'Missing x-organization-id' });

        organizationId = orgIdHeader;
        const member = await prisma.organizationMember.findFirst({
          where: { userId: (request.user as any).id, organizationId },
        });
        if (!member)
          return reply
            .status(401)
            .send({ success: false, error: 'Unauthorized for this organization' });
      }

      await rateLimitService.checkVisitorLimit(ipHash);
      await rateLimitService.checkOrganizationLimit(organizationId);

      // Get or Create Conversation
      if (!conversationId) {
        // Find or create visitor session
        let visitor = await prisma.visitorSession.findFirst({
          where: { organizationId, ipHash },
        });
        if (!visitor) {
          visitor = await prisma.visitorSession.create({
            data: { organizationId, ipHash, userAgent },
          });
        }
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
      reply.raw.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');

      const stream = await chatService.streamChat(organizationId, conversationId, message);

      // Send conversation ID first so client knows it
      reply.raw.write(`data: ${JSON.stringify({ type: 'metadata', conversationId })}\n\n`);

      for await (const chunk of stream) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err: any) {
      if (!isStreaming) {
        return reply.status(500).send({ success: false, error: err.message });
      } else {
        reply.raw.write(
          `data: ${JSON.stringify({ type: 'error', error: err.message || 'Stream failed' })}\n\n`
        );
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
};
