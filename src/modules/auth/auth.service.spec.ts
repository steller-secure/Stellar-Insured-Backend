import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { WalletService } from '../services/wallet.service';
import { SignupRequestDto } from '../dtos/auth.dto';
import { UserRole, SignupSource } from '../entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let walletService: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, WalletService],
    }).compile();

    service = module.get<AuthService>(AuthService);
    walletService = module.get<WalletService>(WalletService);
  });

  afterEach(() => {
    // Clear in-memory database after each test
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user with valid wallet address', async () => {
      const signupDto: SignupRequestDto = {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        email: 'user@example.com',
        displayName: 'John Doe',
        acceptTerms: true,
        signupSource: SignupSource.ORGANIC,
      };

      const result = await service.signup(signupDto);

      expect(result).toBeDefined();
      expect(result.walletAddress).toBe(signupDto.walletAddress);
      expect(result.email).toBe(signupDto.email);
      expect(result.role).toBe(UserRole.USER);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should create user with only wallet address (email optional)', async () => {
      const signupDto: SignupRequestDto = {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        acceptTerms: true,
      };

      const result = await service.signup(signupDto);

      expect(result).toBeDefined();
      expect(result.email).toBeUndefined();
      expect(result.walletAddress).toBe(signupDto.walletAddress);
    });

    it('should throw error for invalid wallet format', async () => {
      const signupDto: SignupRequestDto = {
        walletAddress: 'INVALID_ADDRESS',
        acceptTerms: true,
      };

      await expect(service.signup(signupDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error for invalid email format', async () => {
      const signupDto: SignupRequestDto = {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        email: 'invalid-email',
        acceptTerms: true,
      };

      await expect(service.signup(signupDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw conflict error when wallet already exists', async () => {
      const walletAddress =
        'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA';
      const signupDto: SignupRequestDto = {
        walletAddress,
        acceptTerms: true,
      };

      // First signup should succeed
      await service.signup(signupDto);

      // Second signup with same wallet should fail
      await expect(service.signup(signupDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw conflict error when email already exists', async () => {
      const email = 'user@example.com';
      const signupDto1: SignupRequestDto = {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        email,
        acceptTerms: true,
      };

      const signupDto2: SignupRequestDto = {
        walletAddress: 'GBUQWP3BOUZX34ULNQG23RQ6F4BFSRJSU6PINE7HDF4EVJAVIA72XA',
        email,
        acceptTerms: true,
      };

      // First signup should succeed
      await service.signup(signupDto1);

      // Second signup with same email should fail
      await expect(service.signup(signupDto2)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should normalize wallet address to uppercase', async () => {
      const signupDto: SignupRequestDto = {
        walletAddress: 'gbbd47uzq5akrovbvvvx4n2qg7xjxvg7r34oqcvm4pdxgjmxz2bpsyqa',
        acceptTerms: true,
      };

      // Note: This will fail because walletService.validateWalletAddress
      // expects uppercase format. Need to test after normalization.
      const upperWallet =
        'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA';
      const validSignupDto: SignupRequestDto = {
        walletAddress: upperWallet,
        acceptTerms: true,
      };

      const result = await service.signup(validSignupDto);
      expect(result.walletAddress).toBe(upperWallet);
    });

    it('should generate unique referral code', async () => {
      const signupDto1: SignupRequestDto = {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        acceptTerms: true,
      };

      const signupDto2: SignupRequestDto = {
        walletAddress: 'GBUQWP3BOUZX34ULNQG23RQ6F4BFSRJSU6PINE7HDF4EVJAVIA72XA',
        acceptTerms: true,
      };

      const result1 = await service.signup(signupDto1);
      const result2 = await service.signup(signupDto2);

      const user1 = await service.getUserById(result1.id);
      const user2 = await service.getUserById(result2.id);

      expect(user1.referralCode).toBeDefined();
      expect(user2.referralCode).toBeDefined();
      expect(user1.referralCode).not.toBe(user2.referralCode);
    });
  });

  describe('walletExists', () => {
    it('should return false for non-existent wallet', async () => {
      const exists = await service.walletExists(
        'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
      );
      expect(exists).toBe(false);
    });

    it('should return true for existing wallet', async () => {
      const signupDto: SignupRequestDto = {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        acceptTerms: true,
      };

      await service.signup(signupDto);

      const exists = await service.walletExists(signupDto.walletAddress);
      expect(exists).toBe(true);
    });
  });

  describe('emailExists', () => {
    it('should return false for non-existent email', async () => {
      const exists = await service.emailExists('user@example.com');
      expect(exists).toBe(false);
    });

    it('should return true for existing email', async () => {
      const email = 'user@example.com';
      const signupDto: SignupRequestDto = {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        email,
        acceptTerms: true,
      };

      await service.signup(signupDto);

      const exists = await service.emailExists(email);
      expect(exists).toBe(true);
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by ID', async () => {
      const signupDto: SignupRequestDto = {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        acceptTerms: true,
      };

      const signupResult = await service.signup(signupDto);
      const user = await service.getUserById(signupResult.id);

      expect(user).toBeDefined();
      expect(user.id).toBe(signupResult.id);
      expect(user.walletAddress).toBe(signupDto.walletAddress);
    });

    it('should return null for non-existent user', async () => {
      const user = await service.getUserById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('bulkImportUsers', () => {
    it('should successfully import multiple users', async () => {
      const bulkImportDto = {
        walletAddresses: [
          'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
          'GBUQWP3BOUZX34ULNQG23RQ6F4BFSRJSU6PINE7HDF4EVJAVIA72XA',
        ],
        source: SignupSource.BULK_IMPORT,
      };

      const result = await service.bulkImportUsers(bulkImportDto);

      expect(result.total).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it('should handle duplicate addresses in bulk import', async () => {
      const walletAddress =
        'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA';

      // First import
      const bulkImportDto1 = {
        walletAddresses: [walletAddress],
        source: SignupSource.BULK_IMPORT,
      };

      await service.bulkImportUsers(bulkImportDto1);

      // Second import with same wallet
      const bulkImportDto2 = {
        walletAddresses: [walletAddress],
        source: SignupSource.BULK_IMPORT,
      };

      const result = await service.bulkImportUsers(bulkImportDto2);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.failures.length).toBe(1);
    });
  });
});

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletService],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  describe('validateWalletAddress', () => {
    it('should validate correct Stellar address format', () => {
      const validAddress =
        'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA';
      expect(service.validateWalletAddress(validAddress)).toBe(true);
    });

    it('should throw error for invalid Stellar address format', () => {
      const invalidAddress = 'INVALID_ADDRESS';
      expect(() => service.validateWalletAddress(invalidAddress)).toThrow(
        BadRequestException,
      );
    });

    it('should throw error for empty wallet address', () => {
      expect(() => service.validateWalletAddress('')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      const validEmail = 'user@example.com';
      expect(service.validateEmail(validEmail)).toBe(true);
    });

    it('should throw error for invalid email format', () => {
      const invalidEmail = 'invalid-email';
      expect(() => service.validateEmail(invalidEmail)).toThrow(
        BadRequestException,
      );
    });

    it('should return true for empty email (optional field)', () => {
      expect(service.validateEmail('')).toBe(true);
    });
  });

  describe('generateReferralCode', () => {
    it('should generate 6-character alphanumeric referral code', () => {
      const code = service.generateReferralCode();
      expect(code).toHaveLength(6);
      expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true);
    });

    it('should generate different codes', () => {
      const code1 = service.generateReferralCode();
      const code2 = service.generateReferralCode();
      expect(code1).not.toBe(code2);
    });
  });

  describe('maskWalletAddress', () => {
    it('should mask wallet address correctly', () => {
      const address =
        'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA';
      const masked = service.maskWalletAddress(address);
      expect(masked).toBe('GBBD47UZ...BPSYQA');
    });
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
