import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../di';
import { LoginRequestSchema, RegisterRequestSchema } from '@ion-ai/contracts';

export async function authController(fastify: FastifyInstance) {
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = RegisterRequestSchema.parse(request.body);
    const user = await authService.register(data);

    const token = fastify.jwt.sign({ sub: user.id });

    reply.setCookie('access_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return { success: true, data: user };
  });

  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = LoginRequestSchema.parse(request.body);
    const user = await authService.login(data);

    const token = fastify.jwt.sign({ sub: user.id });

    reply.setCookie('access_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return { success: true, data: user };
  });

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('access_token', { path: '/' });
    return { success: true };
  });

  // Authenticated endpoint
  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest) => {
    return { success: true, data: request.user };
  });
}
