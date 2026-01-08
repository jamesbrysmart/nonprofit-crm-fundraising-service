import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from '../logging/request-context.service';
import { isAuthExemptRequest } from './auth.utils';

export const createFundraisingAuthMiddleware =
  (requestContextService: RequestContextService) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (isAuthExemptRequest(req)) {
      next();
      return;
    }

    const authToken = requestContextService.getAuthToken();
    if (!authToken) {
      res.status(401).json({ message: 'Missing authentication token' });
      return;
    }

    next();
  };
