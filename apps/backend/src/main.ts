import './instrument';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { clientIp } from './auth/client-ip.middleware';

const docs = new DocumentBuilder()
  .setTitle('MicroBuilt API')
  .setDescription(
    `The API behind MicroBuilt: customers request and repay payroll-deducted loans; admins run approvals,
disbursements, payroll variations and repayments.

Sign-in, sign-up, codes, 2FA and passkeys are better-auth's, under /api/auth (endpoint reference:
/api/auth/reference). Browsers use the session cookie. To call these routes from here, sign in on
/api/auth/reference, copy the \`set-auth-token\` header of the response and use it as the bearer token.`,
  )
  .setVersion('2.0')
  .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'better-auth session token (set-auth-token)' })
  .addCookieAuth('better-auth.session_token')
  .build();

function frontendOrigins(): string[] {
  return (process.env.FRONTEND_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

async function bootstrap() {
  // better-auth's module parses request bodies itself (it needs /api/auth unparsed), so Nest's
  // parser is off.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // First, before anything reads the client IP (better-auth's rate limits).
  app.use(clientIp);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // JSON reaches the API through the frontend's origin (Vercel rewrite, no CORS); uploads and
  // downloads come here directly from these origins with the session cookie (D8).
  app.enableCors({
    origin: frontendOrigins(),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 7200,
  });

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, docs));

  await app.listen(process.env.PORT ?? 3003);
}
void bootstrap();
