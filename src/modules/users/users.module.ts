import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UserPortfolio } from './entities/user-portfolio.entity';
import { UserOnboardingChecklist } from './entities/user-onboarding-checklist.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserPreference,
      UserPortfolio,
      UserOnboardingChecklist,
    ]),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
