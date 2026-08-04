import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { EncryptionService } from '../encryption/encryption.service';
import { UserRepository } from '../common/repositories/user.repository';
import { AuditService } from '../insurance/services/audit.service';

interface MockUserRepository {
  findByIdActive: jest.Mock;
  findByWallet: jest.Mock;
  findByWalletUnique: jest.Mock;
  findPaginated: jest.Mock;
  countActive: jest.Mock;
  findWithSettings: jest.Mock;
  createWithSettings: jest.Mock;
  updateUser: jest.Mock;
  cascadeSoftDelete: jest.Mock;
  transaction: jest.Mock;
}

const buildUserRepo = (): MockUserRepository => ({
  findByIdActive: jest.fn(),
  findByWallet: jest.fn(),
  findByWalletUnique: jest.fn(),
  findPaginated: jest.fn(),
  countActive: jest.fn(),
  findWithSettings: jest.fn(),
  createWithSettings: jest.fn(),
  updateUser: jest.fn(),
  cascadeSoftDelete: jest.fn(),
  transaction: jest.fn().mockImplementation(async (fn: any) => fn({})),
});

const encryption = {
  encrypt: jest.fn((value: string) => `encrypted:${value}`),
  decrypt: jest.fn((value: string) => value.replace('encrypted:', '')),
};

const auditService = {
  log: jest.fn(),
  snapshotDiff: jest.fn().mockReturnValue({ beforeState: {}, afterState: {} }),
};

describe('UserService', () => {
  let service: UserService;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    userRepository = buildUserRepo();
    service = new UserService(
      userRepository as unknown as UserRepository,
      encryption as unknown as EncryptionService,
      auditService as unknown as AuditService,
    );
    jest.clearAllMocks();
    // re-attach mocks cleared above
    userRepository.transaction.mockImplementation(async (fn: any) => fn({}));
    auditService.snapshotDiff.mockReturnValue({ beforeState: {}, afterState: {} });
  });

  it('rejects invalid user ID format in findById', async () => {
    await expect(service.findById('<script>alert(1)</script>')).rejects.toThrow(BadRequestException);
    await expect(service.findById('DROP TABLE users;')).rejects.toThrow(BadRequestException);
  });

  it('filters soft-deleted users from id lookups', async () => {
    userRepository.findByIdActive.mockResolvedValue(null);

    await expect(service.findById('clabcdefghij')).rejects.toThrow(NotFoundException);
    expect(userRepository.findByIdActive).toHaveBeenCalledWith('clabcdefghij');
  });

  it('rejects invalid wallet address format in findByWallet', async () => {
    await expect(service.findByWallet('<script>evil()</script>')).rejects.toThrow(BadRequestException);
    await expect(service.findByWallet("'; DROP TABLE users;--")).rejects.toThrow(BadRequestException);
  });

  it('filters soft-deleted users from wallet lookups', async () => {
    userRepository.findByWallet.mockResolvedValue(null);

    await expect(service.findByWallet('GABC123')).rejects.toThrow(NotFoundException);
    expect(userRepository.findByWallet).toHaveBeenCalledWith('GABC123');
  });

  it('excludes soft-deleted users from pagination and totals', async () => {
    userRepository.findPaginated.mockResolvedValue([
      { id: 'user-1', walletAddress: 'GABC123', createdAt: new Date(), updatedAt: new Date() },
    ]);
    userRepository.countActive.mockResolvedValue(1);

    const result = await service.findPaginated(2, 10);

    expect(userRepository.findPaginated).toHaveBeenCalledWith(10, 10);
    expect(userRepository.countActive).toHaveBeenCalled();
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
  });

  it('marks a user as deleted instead of hard deleting the record', async () => {
    const deletedAt = new Date();
    userRepository.findByIdActive.mockResolvedValue({
      id: 'clabcdefghij',
      walletAddress: 'GABC123',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    userRepository.cascadeSoftDelete.mockResolvedValue({
      id: 'clabcdefghij',
      deletedAt,
    });

    const result = await service.delete('clabcdefghij');

    expect(userRepository.cascadeSoftDelete).toHaveBeenCalledWith(
      'clabcdefghij',
      expect.any(Date),
    );
    expect(result.deletedAt).toBe(deletedAt);
  });

  it('refuses to delete a user that is missing or already soft-deleted', async () => {
    userRepository.findByIdActive.mockResolvedValue(null);

    await expect(service.delete('clabcdefghij')).rejects.toThrow(NotFoundException);
    expect(userRepository.cascadeSoftDelete).not.toHaveBeenCalled();
  });

  it('rejects invalid wallet address format in create', async () => {
    await expect(service.create('<script>evil()</script>')).rejects.toThrow(BadRequestException);
  });

  it('prevents duplicate active wallet addresses during create', async () => {
    userRepository.findByWalletUnique.mockResolvedValue({ id: 'user-1' });

    await expect(service.create('GABC123')).rejects.toThrow(ConflictException);
  });

  it('creates a user with encrypted email', async () => {
    const createdUser = {
      id: 'user-new',
      walletAddress: 'GABC123',
      email: 'encrypted:person@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userRepository.findByWalletUnique.mockResolvedValue(null);
    userRepository.createWithSettings.mockResolvedValue(createdUser);

    const result = await service.create('GABC123', ' person@example.com ');

    expect(userRepository.createWithSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: 'GABC123',
        email: 'encrypted:person@example.com',
        notificationSettings: { create: {} },
      }),
      expect.anything(),
    );
    expect(result).toEqual(createdUser);
  });

  it('sanitizes update payloads into explicit repository update data', async () => {
    const existingUser = {
      id: 'clabcdefghij',
      walletAddress: 'GABC123',
      email: null,
      pushSubscription: null,
      profileData: null,
      reputationScore: 0,
      trustScore: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const updatedUser = {
      ...existingUser,
      email: 'encrypted:person@example.com',
      pushSubscription: 'encrypted:subscription',
      profileData: { displayName: 'Ada' },
    };

    userRepository.findByIdActive.mockResolvedValue(existingUser);
    userRepository.updateUser.mockResolvedValue(updatedUser);

    await service.update('clabcdefghij', {
      email: ' person@example.com ',
      profileData: { displayName: '<b>Ada</b>' },
      pushSubscription: ' subscription ',
    });

    expect(userRepository.updateUser).toHaveBeenCalledWith(
      'clabcdefghij',
      expect.objectContaining({
        email: 'encrypted:person@example.com',
        pushSubscription: 'encrypted:subscription',
      }),
      expect.anything(),
    );
  });
});
