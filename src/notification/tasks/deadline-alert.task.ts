import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../services/notification.service';
import { NotificationType } from '../enums/notification-type.enum';
import {
  ProjectRepository,
  ContributionRepository,
  NotificationRepository,
} from '../../common/repositories';

@Injectable()
export class DeadlineAlertTask {
  private readonly logger = new Logger(DeadlineAlertTask.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly contributionRepository: ContributionRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.debug('Checking for projects nearing their deadline...');

    const now = new Date();
    const twentyFourHoursFromNow = new Date(
      now.getTime() + 24 * 60 * 60 * 1000,
    );

    const projects = await this.projectRepository.findMany({
      where: {
        status: 'ACTIVE',
        deadline: { gt: now, lte: twentyFourHoursFromNow },
      },
      include: {
        contributions: {
          select: { investorId: true },
          distinct: ['investorId'],
        },
      },
    }) as any[];

    for (const project of projects) {
      const alertTitle = `24 Hours Left: ${project.title}`;
      const existingAlerts = await this.notificationRepository.findMany({
        where: { type: NotificationType.DEADLINE, title: alertTitle },
        take: 1,
      });

      if (existingAlerts.length > 0) continue;

      this.logger.log(
        `Project ${project.id} is ending in < 24 hours. Notifying contributors.`,
      );

      for (const contribution of project.contributions ?? []) {
        try {
          await this.notificationService.notify(
            contribution.investorId,
            NotificationType.DEADLINE,
            alertTitle,
            `Only 24 hours left for project ${project.title} to reach its goal.`,
            { projectId: project.id },
          );
        } catch (e) {
          this.logger.error(
            `Failed to notify user ${contribution.investorId} of deadline: ${e.message}`,
          );
        }
      }
    }
  }
}
