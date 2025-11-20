import { Controller, Get, Response } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';

type RedirectResponse = Pick<ExpressResponse, 'redirect'>;

@Controller()
export class AppController {
  @Get('fundraising')
  redirectToFundraisingRoot(@Response() res: RedirectResponse): void {
    res.redirect('/fundraising/');
  }
}
