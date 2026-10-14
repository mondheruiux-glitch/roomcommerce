import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Response } from 'express';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    // Disable default body parser — we apply it manually below for raw body access
    bodyParser: false,
  });

  // SEC-04: Apply HTTP security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Next.js inline scripts require this
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', env.CLOUDFLARE_R2_PUBLIC_DOMAIN],
          connectSrc: ["'self'", env.WEB_BASE_URL],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false, // Required for R2 image loading
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // Stripe webhook raw body buffering
  app.use(
    express.json({
      verify: (req: any, _res: Response, buf: Buffer) => {
        if (req.originalUrl?.includes('/webhook')) {
          req.rawBody = buf;
        }
      },
    }),
  );

  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // CORS configuration
  app.enableCors({
    origin: [env.WEB_BASE_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'stripe-signature'],
  });

  // Global validation pipe — strips unknown properties, whitelist DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  await app.listen(env.PORT);
  logger.log(`🚀 RoomCommerce API server live on port ${env.PORT} [${env.NODE_ENV}]`);
}

void bootstrap();
