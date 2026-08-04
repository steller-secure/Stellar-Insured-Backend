import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DatabaseModule } from '../database.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { UserRepository } from '../common/repositories/user.repository';
import { InsuranceModule } from '../insurance/insurance.module';

@Module({
  imports: [DatabaseModule, EncryptionModule, InsuranceModule],
  controllers: [UserController],
  providers: [UserRepository, UserService],
  exports: [UserService, UserRepository],
})
export class UserModule {}
