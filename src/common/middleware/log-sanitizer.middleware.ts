import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { redactValue } from '../utils/log-redaction.util';

@Injectable()
export class LogSanitizerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      req.body = redactValue(req.body) as typeof req.body;
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (body && typeof body === 'object') {
        return originalJson(redactValue(body));
      }
      return originalJson(body);
    };

    next();
  }
}
