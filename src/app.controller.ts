import { Controller, Get, Response } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';

@Controller()
export class AppController {
  @Get('fundraising')
  redirectToFundraisingRoot(@Response() res: ExpressResponse): void {
    res.redirect('/fundraising/');
  }
}
