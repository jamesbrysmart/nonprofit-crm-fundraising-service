import { Test, TestingModule } from '@nestjs/testing';
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
    const redirect = jest.fn();
    controller.redirectToFundraisingRoot({ redirect } as any);
    expect(redirect).toHaveBeenCalledWith('/fundraising/');
  });
});
