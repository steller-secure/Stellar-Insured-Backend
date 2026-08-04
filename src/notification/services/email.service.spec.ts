import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { EmailOutboxRepository } from '../../common/repositories/notification.repository';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { QUEUE_NAMES } from '../constants/queue.constants';

// Mock @sendgrid/mail so the constructor doesn't throw in unit test context
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EmailOutboxRepository,
          useValue: { updateStatus: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'notification.sendgrid.apiKey') return 'test-key';
              if (key === 'notification.sendgrid.fromEmail') return 'noreply@test.com';
              return undefined;
            }),
          },
        },
        {
          provide: getQueueToken(QUEUE_NAMES.EMAIL),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
