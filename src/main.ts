import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

const config = new DocumentBuilder()
  .setTitle('MicroBuilt Loan Management API')
  .setDescription(
    `This is the backend API for the MicroBuilt platform — a service that enables customers to request and manage asset-based or cash-based loans.
    
It supports functionality such as:
- User signup and authentication
- Loan requests (commodities and cash)
- Repayment schedules
- Admin oversight for loan approval and inventory
- Vendor management for asset procurement

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000).catch((e) => console.error(e));
}
bootstrap();
