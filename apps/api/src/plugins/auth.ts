import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { env } from '@ion-ai/config';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      [key: string]: any;
    };
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'access_token',
      signed: false,
    },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify({ onlyCookie: true });
    } catch (err) {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    }
  });
});
