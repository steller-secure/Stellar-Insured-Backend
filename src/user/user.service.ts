import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { EncryptionService } from '../encryption/encryption.service';
import {
  sanitizeString,
  sanitizeObject,
  isValidCuid,
  isValidWalletAddress,
} from '../common/utils/sanitization.util';
import { REPUTATION_DELTAS } from '../reputation/reputation.constants';
import { AuditService } from '../insurance/services/audit.service';
import { AuditAction } from '../insurance/enums/audit-action.enum';
import { UserRepository } from '../common/repositories/user.repository';

export interface PaginatedUsers {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly encryption: EncryptionService,
    private readonly auditService: AuditService,
  ) {}

  async findById(id: string): Promise<User> {
    if (!isValidCuid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const user = await this.userRepository.findByIdActive(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.decryptUser(user);
  }

  async findByWallet(walletAddress: string): Promise<User> {
    if (!isValidWalletAddress(walletAddress)) {
      throw new BadRequestException('Invalid wallet address format');
    }
    const sanitizedAddress = sanitizeString(walletAddress);
    const user = await this.userRepository.findByWallet(sanitizedAddress);
    if (!user) {
      throw new NotFoundException(`User with wallet address ${sanitizedAddress} not found`);
    }
    return this.decryptUser(user);
  }

  async findPaginated(page = 1, limit = 20): Promise<PaginatedUsers> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const offset = Math.max(page - 1, 0) * safeLimit;

    const [users, total] = await Promise.all([
      this.userRepository.findPaginated(offset, safeLimit),
      this.userRepository.countActive(),
    ]);

    return {
      data: users.map(user => this.decryptUser(user)),
      meta: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.max(Math.ceil(total / safeLimit), 1),
      },
    };
  }

  async create(walletAddress: string, email?: string): Promise<User> {
    if (!isValidWalletAddress(walletAddress)) {
      throw new BadRequestException('Invalid wallet address format');
    }
    const sanitizedAddress = sanitizeString(walletAddress);
    const existingUser = await this.userRepository.findByWalletUnique(sanitizedAddress);
    if (existingUser) {
      throw new ConflictException('User with this wallet address already exists');
    }

    const sanitizedEmail = email ? sanitizeString(email) : null;
    const encryptedEmail = sanitizedEmail ? this.encryption.encrypt(sanitizedEmail) : null;

    return this.userRepository.transaction(async tx => {
      return this.userRepository.createWithSettings(
        {
          walletAddress: sanitizedAddress,
          email: encryptedEmail,
          reputationScore: REPUTATION_DELTAS.INITIAL_REPUTATION,
          notificationSettings: { create: {} },
        },
        tx,
      );
    });
  }

  async update(id: string, updateData: UpdateUserDto): Promise<User> {
    if (!isValidCuid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }
    await this.findById(id);

    const data: Prisma.UserUpdateInput = {};

    if (updateData.email !== undefined) {
      data.email = this.encryption.encrypt(sanitizeString(updateData.email));
    }
    if (updateData.profileData !== undefined) {
      data.profileData = this.toJsonInput(sanitizeObject(updateData.profileData));
    }
    if (updateData.pushSubscription !== undefined) {
      data.pushSubscription = this.encryption.encrypt(sanitizeString(updateData.pushSubscription));
    }

    const beforeUser = await this.findById(id);
    const beforeSnapshot = {
      id: beforeUser.id,
      email: beforeUser.email,
      profileData: beforeUser.profileData,
      pushSubscription: beforeUser.pushSubscription,
    };

    const updatedUser = await this.userRepository.transaction(async tx => {
      return this.userRepository.updateUser(id, data, tx);
    });

    const { beforeState, afterState } = this.auditService.snapshotDiff(beforeSnapshot, {
      id: updatedUser.id,
      email: updatedUser.email,
      profileData: updatedUser.profileData,
      pushSubscription: updatedUser.pushSubscription,
    });
    await this.auditService.log(AuditAction.UPDATE, 'User', id, beforeState, afterState, undefined, 'Profile updated');

    return updatedUser;
  }

  async delete(id: string): Promise<{ id: string; deletedAt: Date | null }> {
    await this.findById(id);
    const deletedAt = new Date();
    const deletedUser = await this.userRepository.cascadeSoftDelete(id, deletedAt);
    await this.auditService.log(
      AuditAction.DELETE,
      'User',
      id,
      { id, deletedAt: null },
      { id, deletedAt: deletedUser.deletedAt },
      undefined,
      'User soft-deleted',
    );
    return { id: deletedUser.id, deletedAt: deletedUser.deletedAt };
  }

  async getDecryptedContact(userId: string): Promise<{
    email: string | null;
    pushSubscription: Prisma.JsonValue | null;
    notificationSettings: {
      emailEnabled: boolean;
      pushEnabled: boolean;
      notifyContributions: boolean;
      notifyMilestones: boolean;
      notifyDeadlines: boolean;
    } | null;
  }> {
    if (!isValidCuid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const user = await this.userRepository.findWithSettings(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    const decrypted = this.decryptUser(user);
    return {
      email: decrypted.email,
      pushSubscription: decrypted.pushSubscription,
      notificationSettings: user.notificationSettings ?? null,
    };
  }

  private decryptUser(user: User): User {
    const decrypted = { ...user };
    if (decrypted.email) {
      try { decrypted.email = this.encryption.decrypt(decrypted.email); } catch { /* keep encrypted */ }
    }
    if (decrypted.pushSubscription) {
      try {
        const decryptedJson = this.encryption.decrypt(decrypted.pushSubscription as string);
        decrypted.pushSubscription = JSON.parse(decryptedJson) as Prisma.JsonValue;
      } catch { /* keep encrypted */ }
    }
    return decrypted;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
