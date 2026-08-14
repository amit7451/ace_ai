import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../di';
import { LoginRequestSchema, RegisterRequestSchema } from '@ion-ai/contracts';

const AUTH_RATE_LIMIT = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
};

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function authController(fastify: FastifyInstance) {
  fastify.post(
    '/register',
    AUTH_RATE_LIMIT,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = RegisterRequestSchema.parse(request.body);
      const user = await authService.register(data);

      const token = fastify.jwt.sign({ sub: user.id }, { expiresIn: '7d' });

      reply.setCookie('access_token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE_SECONDS,
        expires: new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000),
      });

      return { success: true, data: user };
    }
  );

  fastify.post('/login', AUTH_RATE_LIMIT, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = LoginRequestSchema.parse(request.body);
    const user = await authService.login(data);

    const token = fastify.jwt.sign({ sub: user.id }, { expiresIn: '7d' });

    reply.setCookie('access_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      expires: new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000),
    });

    return { success: true, data: user };
  });

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('access_token', { path: '/' });
    return { success: true };
  });

  // Authenticated endpoint
  fastify.get(
    '/me',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.sub;
      const user = await authService.getUserById(userId);
      if (!user) {
        return reply
          .status(404)
          .send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      }
      return { success: true, data: { ...user, sub: user.id } };
    }
  );

  // Authenticated endpoint: Update profile
  fastify.put(
    '/profile',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.sub;
      const body = (request.body || {}) as { name?: string };
      const updated = await authService.updateProfile(userId, body);
      return { success: true, data: { ...updated, sub: updated.id } };
    }
  );
}
