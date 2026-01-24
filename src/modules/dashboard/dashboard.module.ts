import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PolicyModule } from '../policy/policy.module';
import { ClaimsModule } from '../claims/claims.module';
// FIX: Changed from '../../dao/dao.module' to '../dao/dao.module'
import { DaoModule } from '../dao/dao.module'; 
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    CacheModule.register(),
    PolicyModule,
    ClaimsModule,
    DaoModule, // Now pointing to the correct src/modules/dao
    NotificationModule
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}