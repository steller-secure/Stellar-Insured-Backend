import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Keypair } from 'stellar-sdk';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;
  let cacheManager: any;

  const mockUser = {
    id: 'user-123',
    walletAddress: '',
    roles: ['USER'],
    lastLoginAt: undefined,
  };

  const mockCacheStore = new Map();

  beforeEach(async () => {
    mockCacheStore.clear();

    usersService = {
      findByWalletAddress: jest.fn(),
      updateLastLogin: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock_token'),
    };

    cacheManager = {
      set: jest
        .fn()
        .mockImplementation((key, value) => mockCacheStore.set(key, value)),
      get: jest.fn().mockImplementation(key => mockCacheStore.get(key)),
      del: jest.fn().mockImplementation(key => mockCacheStore.delete(key)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should complete full auth flow', async () => {
    const keypair = Keypair.random();
    const walletAddress = keypair.publicKey();
    mockUser.walletAddress = walletAddress;

    // Mock finding user
    (usersService.findByWalletAddress as jest.Mock).mockResolvedValue(mockUser);

    // 1. Generate Challenge
    const challengeRes = await service.generateChallenge(walletAddress);
    expect(challengeRes).toHaveProperty('challenge');
    expect(challengeRes).toHaveProperty('expiresAt');
    expect(cacheManager.set).toHaveBeenCalled();

    const message = challengeRes.challenge;

    // 2. Sign Message
    const signature = keypair.sign(Buffer.from(message)).toString('base64');

    // 3. Login
    const loginRes = await service.login(walletAddress, signature);
    expect(loginRes).toHaveProperty('accessToken', 'mock_token');
    expect(loginRes.user.walletAddress).toBe(walletAddress);

    // Verify cache cleared
    expect(cacheManager.del).toHaveBeenCalled();
  });

  it('should fail with invalid signature', async () => {
    const keypair = Keypair.random();
    const walletAddress = keypair.publicKey();

    // Generate valid challenge
    const challengeRes = await service.generateChallenge(walletAddress);
    const message = challengeRes.challenge;

    // Sign with WRONG key
    const wrongKeypair = Keypair.random();
    const signature = wrongKeypair
      .sign(Buffer.from(message))
      .toString('base64');

    await expect(service.login(walletAddress, signature)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
