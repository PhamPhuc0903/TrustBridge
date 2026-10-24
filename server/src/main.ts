import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { Request, Response } from 'express';
import { AppModule } from './module';
import { ApiExceptionFilter } from './api-exception.filter';

async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Copy .env.example to .env');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','), credentials: false});
  app.useGlobalPipes(new ValidationPipe({whitelist:true, forbidNonWhitelisted:true, transform:true}));
  app.useGlobalFilters(new ApiExceptionFilter());
  // NestJS REST API on :8000. Vite frontend on :5173 in development.
  // In production, serve the built React SPA from client/dist if available.
  const clientDist = join(__dirname, '../../client/dist');
  if (existsSync(clientDist)) app.useStaticAssets(clientDist);
  const config = new DocumentBuilder()
    .setTitle('TrustBridge — Backend NestJS API')
    .setDescription('Classroom demo. AI, eKYC, fees and escrow are simulated; no real fund transfers.')
    .setVersion('1.0.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.init();
  if (existsSync(join(clientDist, 'index.html'))) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get(/^\/(?!api\/|docs(?:\/|$)).*/, (req: Request, res: Response) => {
      if (req.path.includes('.')) return res.status(404).send('Not found');
      return res.sendFile(join(clientDist, 'index.html'));
    });
  }
  await app.listen(Number(process.env.PORT || 8000), '127.0.0.1');
  console.log(`TrustBridge demo: http://localhost:${process.env.PORT || 8000}  Swagger: /docs`);
}
bootstrap().catch(err => { console.error(err); process.exit(1); });
