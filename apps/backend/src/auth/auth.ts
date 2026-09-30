// Input for the better-auth CLI only: `auth generate` reads the plugins and options below to
// generate the auth models in prisma/schema.prisma (V2.MD Stage 1). The running app builds its
// own instance with real senders, Redis and lookups in auth.module.ts — never import this file.
import { PrismaClient } from '@prisma/client';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuth } from './auth.config';

const noop = async () => {};

export const auth = createAuth({
  baseURL: 'http://localhost:3000',
  secret: 'better-auth-cli-schema-generation-only',
  frontendURL: 'http://localhost:3000',
  trustedOrigins: [],
  database: prismaAdapter(new PrismaClient(), { provider: 'postgresql' }),
  secureCookies: false,
  passkey: { rpID: 'localhost', origin: 'http://localhost:3000' },
  generateUserId: () => {
    throw new Error('src/auth/auth.ts is for schema generation and never creates users');
  },
  senders: { emailOtp: noop, magicLink: noop, passwordReset: noop, twoFactorEmail: noop, sms: noop },
  lookups: { userGate: async () => null, emailAccountType: async () => null },
});
