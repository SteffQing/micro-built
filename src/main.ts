import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

const config = new DocumentBuilder()
  .setTitle('MicroBuilt Loan Management API')
  .setDescription(
    `This is the backend API for the MicroBuilt platform — a service that enables customers to request and manage asset-based or cash-based loans.
    
It supports functionality such as:
- User signup and authentication
- Loan requests (commodities and cash)
- Repayment schedules
- Admin oversight for loan approval

All endpoints are secured via JWT authentication and support both web and mobile client integrations.`,
  )
  .setVersion('1.0')
  .addBearerAuth({
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  })
  .build();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://micro-built.vercel.app',
      'https://microbuiltprime.com',
      'https://www.microbuiltprime.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3003).catch((e) => console.error(e));
}
bootstrap();
