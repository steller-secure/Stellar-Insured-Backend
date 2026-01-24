import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import {
  ClaimEventListeners,
  PolicyEventListeners,
  DaoEventListeners,
} from './listeners';

/**
 * NotificationModule handles notification creation via event listeners.
 * Does NOT import business modules - communication is purely event-driven.
 * Now integrated with TypeORM for persistence.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    ClaimEventListeners,
    PolicyEventListeners,
    DaoEventListeners,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
