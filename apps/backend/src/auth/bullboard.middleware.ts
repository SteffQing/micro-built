import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { NextFunction, Request } from 'express';

@Injectable()
export class BullBoardMiddleware implements NestMiddleware {
  use(req: Request, _: unknown, next: NextFunction) {
    const accessKey = req.cookies?.['bull_board_token'];

    if (accessKey !== process.env.COOKIE_SECRET) {
      throw new ForbiddenException('Please log in via the Admin Dashboard');
    }

    next();
  }
}
