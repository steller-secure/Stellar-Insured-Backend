import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { WebPushService } from './services/web-push.service';
import { DeadlineAlertTask } from './tasks/deadline-alert.task';
import { EmailRetryTask } from './tasks/email-retry.task';
import { NotificationEventListener } from '../common/events/listeners/notification-event.listener';
import { DatabaseModule } from '../database.module';
import { UserModule } from '../user/user.module';
import { QueueModule } from '../queue.module';

@Module({
  imports: [DatabaseModule, UserModule, QueueModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailService,
    WebPushService,
    DeadlineAlertTask,
    EmailRetryTask,
    NotificationEventListener,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
