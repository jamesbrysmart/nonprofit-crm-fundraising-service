import { config } from 'dotenv';
config();
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { RequestContextService } from './logging/request-context.service';
import { RequestMethod } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix('api/fundraising', {
    exclude: [{ path: 'health', method: RequestMethod.ALL }],
  });
  const requestContextService = app.get(RequestContextService);
  const clientAssetsPath = join(__dirname, '..', 'client');

  app.use((req: Request, res: Response, next: NextFunction) => {
    const headerValue = req.headers['x-request-id'];
    const providedRequestId = Array.isArray(headerValue)
      ? headerValue.find(Boolean)
      : headerValue;
    const requestId = providedRequestId?.toString().trim() || randomUUID();

    res.setHeader('x-request-id', requestId);

    requestContextService.runWith({ requestId }, () => next());
  });

  const fundraisingRouter = express.Router();
  fundraisingRouter.use(express.static(clientAssetsPath));
  fundraisingRouter.use((_req: Request, res: Response) => {
    res.sendFile(join(clientAssetsPath, 'index.html'));
  });
  app.use('/fundraising', fundraisingRouter);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
