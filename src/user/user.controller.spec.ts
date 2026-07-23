import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockUser = {
  id: 'user-123',
  walletAddress: 'GABC123',
  reputationScore: 100,
  trustScore: 90,
  email: 'test@example.com',
  profileData: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserService = {
  findById: jest.fn(),
  findByWallet: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findPaginated: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('should return user data when user exists', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      const result = (await controller.getUser({ id: 'user-123' })) as any;
      expect(result.id).toBe('user-123');
      expect(result.walletAddress).toBe('GABC123');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserService.findById.mockRejectedValue(
        new NotFoundException('User with ID nonexistent not found'),
      );
      await expect(controller.getUser({ id: 'nonexistent' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserByWallet', () => {
    it('should throw NotFoundException when wallet address not found', async () => {
      mockUserService.findByWallet.mockRejectedValue(
        new NotFoundException('User with wallet address GXXX not found'),
      );
      await expect(
        controller.getUserByWallet({ address: 'GXXX' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should return a soft-delete acknowledgement payload', async () => {
      const deletedAt = new Date('2026-04-24T00:00:00.000Z');
      mockUserService.delete.mockResolvedValue({ id: 'user-123', deletedAt });

      await expect(controller.deleteUser({ id: 'user-123' })).resolves.toEqual({
        success: true,
        id: 'user-123',
        deletedAt,
      });
    });
  });
});
