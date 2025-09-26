import { config } from 'dotenv';
config();
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { RequestContextService } from './logging/request-context.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const requestContextService = app.get(RequestContextService);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const headerValue = req.headers['x-request-id'];
    const providedRequestId = Array.isArray(headerValue)
      ? headerValue.find(Boolean)
      : headerValue;
    const requestId = providedRequestId?.toString().trim() || randomUUID();

    res.setHeader('x-request-id', requestId);

    requestContextService.runWith({ requestId }, () => next());
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
