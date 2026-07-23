import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { EncryptionService } from '../encryption/encryption.service';
import {
  sanitizeString,
  sanitizeObject,
  isValidCuid,
  isValidWalletAddress,
} from '../common/utils/sanitization.util';
import { REPUTATION_DELTAS } from '../reputation/reputation.constants';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';
import { Prisma, User } from '@prisma/client';

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
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly eventBus: DomainEventBus,
  ) {}

  async findById(id: string): Promise<User> {
    if (!isValidCuid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
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

    const user = await this.prisma.user.findFirst({
      where: {
        walletAddress: sanitizedAddress,
        deletedAt: null,
      },
    });
    if (!user) {
      throw new NotFoundException(
        `User with wallet address ${sanitizedAddress} not found`,
      );
    }
    return this.decryptUser(user);
  }

  async findPaginated(page = 1, limit = 20): Promise<PaginatedUsers> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const offset = Math.max(page - 1, 0) * safeLimit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        skip: offset,
        take: safeLimit,
      }),
      this.prisma.user.count({
        where: { deletedAt: null },
      }),
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

    const existingUser = await this.prisma.user.findUnique({
      where: { walletAddress: sanitizedAddress },
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this wallet address already exists',
      );
    }

    const sanitizedEmail = email ? sanitizeString(email) : null;
    const encryptedEmail = sanitizedEmail
      ? this.encryption.encrypt(sanitizedEmail)
      : null;

    const user = await this.prisma.$transaction(async tx => {
      return tx.user.create({
        data: {
          walletAddress: sanitizedAddress,
          email: encryptedEmail,
          reputationScore: REPUTATION_DELTAS.INITIAL_REPUTATION,
          notificationSettings: {
            create: {},
          },
        },
        include: { notificationSettings: true },
      });
    });
    return user;
  }

  async update(id: string, updateData: UpdateUserDto): Promise<User> {
    if (!isValidCuid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const beforeUser = await this.findById(id);
    const beforeSnapshot = {
      id: beforeUser.id,
      email: beforeUser.email,
      profileData: beforeUser.profileData,
      pushSubscription: beforeUser.pushSubscription,
    };

    const data: Prisma.UserUpdateInput = {};

    if (updateData.email !== undefined) {
      data.email = this.encryption.encrypt(sanitizeString(updateData.email));
    }

    if (updateData.profileData !== undefined) {
      data.profileData = this.toJsonInput(
        sanitizeObject(updateData.profileData),
      );
    }

    if (updateData.pushSubscription !== undefined) {
      data.pushSubscription = this.encryption.encrypt(
        sanitizeString(updateData.pushSubscription),
      );
    }

    const updatedUser = await this.prisma.$transaction(async tx => {
      return tx.user.update({
        where: { id },
        data,
      });
    });

    const afterSnapshot = {
      id: updatedUser.id,
      email: updatedUser.email,
      profileData: updatedUser.profileData,
      pushSubscription: updatedUser.pushSubscription,
    };

    await this.eventBus.emit(DomainEventName.USER_UPDATED, {
      userId: id,
      beforeState: beforeSnapshot,
      afterState: afterSnapshot,
      reason: 'Profile updated',
    });

    return updatedUser;
  }

  async delete(id: string): Promise<{ id: string; deletedAt: Date | null }> {
    await this.findById(id);

    const deletedAt = new Date();

    const [deletedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { deletedAt },
      }),
      this.prisma.notification.updateMany({
        where: { userId: id },
        data: { deletedAt },
      }),
      this.prisma.notificationSetting.updateMany({
        where: { userId: id },
        data: { deletedAt },
      }),
      this.prisma.insurancePolicy.updateMany({
        where: { userId: id },
        data: { deletedAt },
      }),
      this.prisma.claim.updateMany({
        where: { policy: { userId: id } },
        data: { deletedAt },
      }),
    ]);

    await this.eventBus.emit(DomainEventName.USER_DELETED, {
      userId: id,
      beforeState: { id, deletedAt: null },
      afterState: { id, deletedAt: deletedUser.deletedAt },
      reason: 'User soft-deleted',
    });

    return {
      id: deletedUser.id,
      deletedAt: deletedUser.deletedAt,
    };
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

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: { notificationSettings: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const decrypted = this.decryptUser(user);
    return {
      email: decrypted.email,
      pushSubscription: decrypted.pushSubscription,
      notificationSettings: user.notificationSettings,
    };
  }

  private decryptUser(user: User): User {
    const decrypted = { ...user };

    if (decrypted.email) {
      try {
        decrypted.email = this.encryption.decrypt(decrypted.email);
      } catch {}
    }

    if (decrypted.pushSubscription) {
      try {
        const decryptedJson = this.encryption.decrypt(
          decrypted.pushSubscription as string,
        );
        decrypted.pushSubscription = JSON.parse(
          decryptedJson,
        ) as Prisma.JsonValue;
      } catch {}
    }

    return decrypted;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
