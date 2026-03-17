import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './common/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.setGlobalPrefix('api');

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : true;
  app.enableCors({ origin: corsOrigin });

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';

  await app.listen(port, host);
  console.log(`API listening on ${await app.getUrl()}`);
}
bootstrap();
