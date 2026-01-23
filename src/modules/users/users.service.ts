import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface User {
  id: string;
  walletAddress: string;
  email?: string;
  roles: string[];
  lastLoginAt?: Date;
}

@Injectable()
export class UsersService {
  private users: User[] = [];

  findByWalletAddress(walletAddress: string): Promise<User | undefined> {
    return Promise.resolve(
      this.users.find(u => u.walletAddress === walletAddress),
    );
  }

  create(walletAddress: string): Promise<User> {
    const newUser: User = {
      id: crypto.randomUUID(),
      walletAddress,
      roles: ['USER'],
    };
    this.users.push(newUser);
    return Promise.resolve(newUser);
  }

  updateLastLogin(id: string): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) {
      user.lastLoginAt = new Date();
    }
    return Promise.resolve();
  }
}
