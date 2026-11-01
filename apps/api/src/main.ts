import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LoggingInterceptor } from './common/logging.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';

const DEFAULT_CORS_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:43101',
  'http://localhost:43101',
];

export function resolveAllowedOrigins(
  configured = process.env.CORS_ORIGIN,
): string[] {
  const origins = configured
    ? configured
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : DEFAULT_CORS_ORIGINS;
  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}

export function isAllowedMutatingRequest(
  req: Pick<Request, 'method' | 'headers'>,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      return false;
    }
  }

  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    return allowedOrigins.has(origin);
  }

  return true;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.setGlobalPrefix('api');

  const corsOrigin = resolveAllowedOrigins();
  const allowedOriginSet = new Set(corsOrigin);

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!isAllowedMutatingRequest(req, allowedOriginSet)) {
      next(new ForbiddenException('Cross-origin request blocked.'));
      return;
    }
    next();
  });

  app.enableCors({ origin: corsOrigin });

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';

  await app.listen(port, host);
  console.log(`API listening on ${await app.getUrl()}`);
}

if (require.main === module) {
  void bootstrap();
}
