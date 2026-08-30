import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { QUEUE_NAMES } from '../config/bull.config';
import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

describe('StorageService', () => {
  let service: StorageService;

  const config = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'storage.ipfs.host':
          return 'localhost';
        case 'storage.ipfs.port':
          return 5001;
        case 'storage.ipfs.protocol':
          return 'http';
        case 'AWS_REGION':
          return 'us-east-1';
        case 'AWS_ACCESS_KEY_ID':
          return 'test-key';
        case 'AWS_SECRET_ACCESS_KEY':
          return 'test-secret';
        case 'AWS_S3_BUCKET':
          return 'test-bucket';
        default:
          return undefined;
      }
    }),
  };

  const queue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: config },
        { provide: getQueueToken(QUEUE_NAMES.IPFS_PIN), useValue: queue },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  const file = (overrides: Record<string, unknown> = {}) =>
    ({
      fieldname: 'file',
      originalname: 'photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('jpeg-data'),
      stream: null,
      destination: '',
      filename: '',
      path: '',
      ...overrides,
    }) as Express.Multer.File;

  describe('chaos — AWS S3 outage', () => {
    it('retries transient failures then surfaces an InternalServerErrorException', async () => {
      (service as any).s3 = {
        send: jest.fn().mockRejectedValue(new Error('s3 down')),
      };

      await expect(service.uploadFile(file())).rejects.toThrow(
        InternalServerErrorException,
      );
      // AWS_S3_POLICY: 3 attempts per upload.
      expect((service as any).s3.send).toHaveBeenCalledTimes(3);
    });

    it('stops calling S3 once the circuit is open (fail fast)', async () => {
      (service as any).s3 = {
        send: jest.fn().mockRejectedValue(new Error('s3 down')),
      };

      // Drive enough failures to trip the breaker (volumeThreshold 5).
      for (let i = 0; i < 3; i++) {
        await expect(service.uploadFile(file())).rejects.toThrow(
          InternalServerErrorException,
        );
      }
      const callsAfterTrips = (service as any).s3.send.mock.calls.length;

      // Once open, further uploads must not hit S3 at all.
      await expect(service.uploadFile(file())).rejects.toThrow(
        InternalServerErrorException,
      );
      expect((service as any).s3.send.mock.calls.length).toBe(callsAfterTrips);
    });
  });

  describe('chaos — IPFS outage', () => {
    it('retries pin failures then surfaces ServiceUnavailableException', async () => {
      (service as any).ipfs = {
        add: jest.fn().mockRejectedValue(new Error('ipfs down')),
        cat: jest.fn(),
      };

      await expect(
        service.pinProjectMetadata({ projectId: 'p1' }),
      ).rejects.toThrow(ServiceUnavailableException);
      // IPFS_POLICY: 2 attempts per pin.
      expect((service as any).ipfs.add).toHaveBeenCalledTimes(2);
    });

    it('verifies an IPFS hash through the breaker', async () => {
      (service as any).ipfs = {
        add: jest.fn(),
        cat: jest.fn(async function* () {
          yield Buffer.from('chunk');
        }),
      };

      await expect(service.verifyIPFSHash('QmHash')).resolves.toBe(true);
      expect((service as any).ipfs.cat).toHaveBeenCalledTimes(1);
    });
  });

  describe('chaos — Bull queue (Redis) outage', () => {
    it('retries the enqueue and rethrows when Redis is down', async () => {
      queue.add.mockRejectedValue(new Error('redis down'));

      await expect(
        service.queuePinProjectMetadata({ projectId: 'p1' }),
      ).rejects.toThrow('redis down');
      // BULL_QUEUE_POLICY: 2 attempts per enqueue.
      expect(queue.add).toHaveBeenCalledTimes(2);
    });
  });
});
