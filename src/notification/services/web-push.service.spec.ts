import { Test, TestingModule } from '@nestjs/testing';
import { WebPushService } from './web-push.service';
import { ConfigService } from '@nestjs/config';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('WebPushService', () => {
  let service: WebPushService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebPushService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test') },
        },
      ],
    }).compile();

    service = module.get<WebPushService>(WebPushService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
