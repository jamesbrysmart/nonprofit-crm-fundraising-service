import { Test, TestingModule } from '@nestjs/testing';
import type { Response as ExpressResponse } from 'express';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('redirects /fundraising to the trailing slash path', () => {
    const response: Pick<ExpressResponse, 'redirect'> = {
      redirect: jest.fn(),
    };
    controller.redirectToFundraisingRoot(response);
    expect(response.redirect).toHaveBeenCalledWith('/fundraising/');
  });
});
