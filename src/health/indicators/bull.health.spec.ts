import { Test, TestingModule } from '@nestjs/testing';
import { BullHealthIndicator } from './bull.health';
import { getQueueToken } from '@nestjs/bull';
import { HealthCheckError } from '@nestjs/terminus';
import { QUEUE_NAMES } from '../../config/bull.config';

describe('BullHealthIndicator', () => {
  let indicator: BullHealthIndicator;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      getJobCounts: jest.fn().mockResolvedValue({
        active: 0,
        completed: 5,
        failed: 0,
        delayed: 0,
        waiting: 2,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullHealthIndicator,
        {
          provide: getQueueToken(QUEUE_NAMES.EMAIL),
          useValue: mockQueue,
        },
      ],
    }).compile();

    indicator = module.get<BullHealthIndicator>(BullHealthIndicator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isHealthy', () => {
    it('should return healthy status with job counts when queue is healthy', async () => {
      const result = await indicator.isHealthy('queue');

      expect(result).toHaveProperty('queue');
      expect(result.queue).toHaveProperty('status', 'up');
      expect(result.queue.type).toBe('bull');
      expect(result.queue.jobCounts).toEqual({
        active: 0,
        completed: 5,
        failed: 0,
        delayed: 0,
        waiting: 2,
      });
    });

    it('should include job counts in the response', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        active: 3,
        completed: 15,
        failed: 1,
        delayed: 2,
        waiting: 5,
      });

      const result = await indicator.isHealthy('queue');

      expect(result.queue.jobCounts).toEqual({
        active: 3,
        completed: 15,
        failed: 1,
        delayed: 2,
        waiting: 5,
      });
    });

    it('should throw HealthCheckError when queue is disconnected', async () => {
      const error = new Error('Queue client disconnected');
      mockQueue.getJobCounts.mockRejectedValue(error);

      await expect(indicator.isHealthy('queue')).rejects.toThrow(
        HealthCheckError,
      );
    });

    it('should throw HealthCheckError when Redis backend is unavailable', async () => {
      const error = new Error('Redis connection refused');
      mockQueue.getJobCounts.mockRejectedValue(error);

      await expect(indicator.isHealthy('queue')).rejects.toThrow(
        HealthCheckError,
      );
    });

    it('should capture error message in HealthCheckError', async () => {
      const errorMessage = 'Connection timeout';
      mockQueue.getJobCounts.mockRejectedValue(new Error(errorMessage));

      try {
        await indicator.isHealthy('queue');
        fail('Should have thrown HealthCheckError');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
      }
    });

    it('should handle non-Error exceptions', async () => {
      mockQueue.getJobCounts.mockRejectedValue('Unknown error');

      try {
        await indicator.isHealthy('queue');
        fail('Should have thrown HealthCheckError');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
      }
    });
  });
});
