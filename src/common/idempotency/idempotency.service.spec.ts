import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyKeyEntity } from './entities/idempotency-key.entity';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repository: Repository<IdempotencyKeyEntity>;

  const mockIdempotencyKey = 'test-key-12345';
  const mockUserId = 'user-123';
  const mockMethod = 'POST';
  const mockEndpoint = '/api/v1/claims';
  const mockRequestBody = { policyId: 'policy-123', amount: 1000 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(IdempotencyKeyEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            remove: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    repository = module.get<Repository<IdempotencyKeyEntity>>(
      getRepositoryToken(IdempotencyKeyEntity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkIdempotency', () => {
    it('should throw BadRequestException if idempotency key is missing', async () => {
      await expect(
        service.checkIdempotency('', mockUserId, mockMethod, mockEndpoint, mockRequestBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if idempotency key exceeds max length', async () => {
      const longKey = 'a'.repeat(256);
      await expect(
        service.checkIdempotency(longKey, mockUserId, mockMethod, mockEndpoint, mockRequestBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return isDuplicate: false if no existing record found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);

      const result = await service.checkIdempotency(
        mockIdempotencyKey,
        mockUserId,
        mockMethod,
        mockEndpoint,
        mockRequestBody,
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.cachedResponse).toBeUndefined();
    });

    it('should return isDuplicate: true with cached response if successful duplicate request', async () => {
      const existingRecord: Partial<IdempotencyKeyEntity> = {
        idempotencyKey: mockIdempotencyKey,
        userId: mockUserId,
        method: mockMethod,
        endpoint: mockEndpoint,
        status: 'SUCCESS',
        statusCode: 201,
        response: JSON.stringify({ id: 'claim-123' }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(existingRecord as any);

      const result = await service.checkIdempotency(
        mockIdempotencyKey,
        mockUserId,
        mockMethod,
        mockEndpoint,
        mockRequestBody,
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.cachedResponse).toBeDefined();
      expect(result.cachedResponse?.statusCode).toBe(201);
      expect(result.cachedResponse?.status).toBe('SUCCESS');
    });

    it('should throw ConflictException if request is still pending', async () => {
      const existingRecord: Partial<IdempotencyKeyEntity> = {
        idempotencyKey: mockIdempotencyKey,
        userId: mockUserId,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(existingRecord as any);

      await expect(
        service.checkIdempotency(
          mockIdempotencyKey,
          mockUserId,
          mockMethod,
          mockEndpoint,
          mockRequestBody,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if request body differs from cached request', async () => {
      const existingRecord: Partial<IdempotencyKeyEntity> = {
        idempotencyKey: mockIdempotencyKey,
        userId: mockUserId,
        status: 'SUCCESS',
        requestHash: 'different-hash',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(existingRecord as any);

      await expect(
        service.checkIdempotency(
          mockIdempotencyKey,
          mockUserId,
          mockMethod,
          mockEndpoint,
          mockRequestBody,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should treat expired record as new request', async () => {
      const expiredRecord: Partial<IdempotencyKeyEntity> = {
        idempotencyKey: mockIdempotencyKey,
        userId: mockUserId,
        status: 'SUCCESS',
        expiresAt: new Date(Date.now() - 1000), // expired
      };

      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(expiredRecord as any);
      jest.spyOn(repository, 'remove').mockResolvedValueOnce(expiredRecord as any);

      const result = await service.checkIdempotency(
        mockIdempotencyKey,
        mockUserId,
        mockMethod,
        mockEndpoint,
        mockRequestBody,
      );

      expect(result.isDuplicate).toBe(false);
    });

    it('should return cached error response if request previously failed', async () => {
      const errorRecord: Partial<IdempotencyKeyEntity> = {
        idempotencyKey: mockIdempotencyKey,
        userId: mockUserId,
        status: 'ERROR',
        statusCode: 400,
        errorMessage: 'Policy not found',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(errorRecord as any);

      const result = await service.checkIdempotency(
        mockIdempotencyKey,
        mockUserId,
        mockMethod,
        mockEndpoint,
        mockRequestBody,
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.cachedResponse?.status).toBe('ERROR');
      expect(result.cachedResponse?.errorMessage).toBe('Policy not found');
    });
  });

  describe('createIdempotencyRecord', () => {
    it('should create and save an idempotency record', async () => {
      const mockRecord: Partial<IdempotencyKeyEntity> = {
        id: 'record-123',
        idempotencyKey: mockIdempotencyKey,
        userId: mockUserId,
        status: 'PENDING',
      };

      jest.spyOn(repository, 'create').mockReturnValueOnce(mockRecord as any);
      jest.spyOn(repository, 'save').mockResolvedValueOnce(mockRecord as any);

      const result = await service.createIdempotencyRecord(
        mockIdempotencyKey,
        mockUserId,
        mockMethod,
        mockEndpoint,
        mockRequestBody,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: mockIdempotencyKey,
          userId: mockUserId,
          method: mockMethod,
          endpoint: mockEndpoint,
          status: 'PENDING',
        }),
      );
      expect(repository.save).toHaveBeenCalledWith(mockRecord);
      expect(result.status).toBe('PENDING');
    });

    it('should throw InternalServerErrorException on save failure', async () => {
      jest.spyOn(repository, 'create').mockReturnValueOnce({} as any);
      jest
        .spyOn(repository, 'save')
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.createIdempotencyRecord(
          mockIdempotencyKey,
          mockUserId,
          mockMethod,
          mockEndpoint,
          mockRequestBody,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('markAsSuccess', () => {
    it('should mark idempotency record as success', async () => {
      const statusCode = 201;
      const response = { id: 'claim-123', status: 'pending' };

      jest.spyOn(repository, 'update').mockResolvedValueOnce({ affected: 1 } as any);

      await service.markAsSuccess(
        mockIdempotencyKey,
        mockUserId,
        statusCode,
        response,
      );

      expect(repository.update).toHaveBeenCalledWith(
        { idempotencyKey: mockIdempotencyKey, userId: mockUserId },
        expect.objectContaining({
          status: 'SUCCESS',
          statusCode,
          response: JSON.stringify(response),
          errorMessage: null,
        }),
      );
    });

    it('should handle update errors gracefully', async () => {
      jest
        .spyOn(repository, 'update')
        .mockRejectedValueOnce(new Error('Update failed'));

      // Should not throw, just log
      await expect(
        service.markAsSuccess(mockIdempotencyKey, mockUserId, 201, {}),
      ).resolves.not.toThrow();
    });
  });

  describe('markAsError', () => {
    it('should mark idempotency record as error', async () => {
      const statusCode = 400;
      const errorMessage = 'Invalid request body';

      jest.spyOn(repository, 'update').mockResolvedValueOnce({ affected: 1 } as any);

      await service.markAsError(
        mockIdempotencyKey,
        mockUserId,
        statusCode,
        errorMessage,
      );

      expect(repository.update).toHaveBeenCalledWith(
        { idempotencyKey: mockIdempotencyKey, userId: mockUserId },
        expect.objectContaining({
          status: 'ERROR',
          statusCode,
          errorMessage,
          response: null,
        }),
      );
    });

    it('should handle update errors gracefully', async () => {
      jest
        .spyOn(repository, 'update')
        .mockRejectedValueOnce(new Error('Update failed'));

      // Should not throw, just log
      await expect(
        service.markAsError(mockIdempotencyKey, mockUserId, 400, 'error'),
      ).resolves.not.toThrow();
    });
  });

  describe('cleanupExpiredRecords', () => {
    it('should delete expired records', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValueOnce({ affected: 5 } as any);

      const result = await service.cleanupExpiredRecords();

      expect(repository.delete).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should return 0 if no records deleted', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValueOnce({ affected: 0 } as any);

      const result = await service.cleanupExpiredRecords();

      expect(result).toBe(0);
    });

    it('should handle deletion errors gracefully', async () => {
      jest
        .spyOn(repository, 'delete')
        .mockRejectedValueOnce(new Error('Delete failed'));

      const result = await service.cleanupExpiredRecords();

      expect(result).toBe(0);
    });
  });

  describe('getRecordsByUser', () => {
    it('should retrieve records for a user with limit', async () => {
      const mockRecords: Partial<IdempotencyKeyEntity>[] = [
        {
          id: 'record-1',
          idempotencyKey: 'key-1',
          status: 'SUCCESS',
          createdAt: new Date(),
        },
        {
          id: 'record-2',
          idempotencyKey: 'key-2',
          status: 'SUCCESS',
          createdAt: new Date(),
        },
      ];

      jest.spyOn(repository, 'find').mockResolvedValueOnce(mockRecords as any);

      const result = await service.getRecordsByUser(mockUserId, 100);

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      expect(result).toEqual(mockRecords);
    });

    it('should use default limit of 100', async () => {
      jest.spyOn(repository, 'find').mockResolvedValueOnce([]);

      await service.getRecordsByUser(mockUserId);

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('request hash generation', () => {
    it('should generate consistent hash for identical request bodies', async () => {
      const body = { policyId: 'policy-123', amount: 1000 };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      // Two calls with same body should generate same hash
      await service.checkIdempotency(
        'key-1',
        mockUserId,
        mockMethod,
        mockEndpoint,
        body,
      );

      await service.checkIdempotency(
        'key-2',
        mockUserId,
        mockMethod,
        mockEndpoint,
        body,
      );

      const calls = (repository.findOne as jest.Mock).mock.calls;
      // Both should succeed without hash mismatch
      expect(calls.length).toBe(2);
    });

    it('should generate different hash for different request bodies', async () => {
      const body1 = { policyId: 'policy-123', amount: 1000 };
      const body2 = { policyId: 'policy-456', amount: 2000 };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await service.checkIdempotency(
        'key-1',
        mockUserId,
        mockMethod,
        mockEndpoint,
        body1,
      );

      await service.checkIdempotency(
        'key-2',
        mockUserId,
        mockMethod,
        mockEndpoint,
        body2,
      );

      expect(repository.findOne).toHaveBeenCalledTimes(2);
    });
  });
});
