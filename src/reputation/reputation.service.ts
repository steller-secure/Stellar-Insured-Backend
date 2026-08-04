import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { calculateTrustScore } from './calculators/trust-score.calculator';
import { ReputationRepository } from '../common/repositories/reputation.repository';

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reputationRepository: ReputationRepository,
  ) {}

  async updateTrustScore(userId: string): Promise<number> {
    const score = await calculateTrustScore(this.prisma, userId);
    await this.reputationRepository.updateTrustScore(userId, score);
    return score;
  }

  async adjustReputation(userId: string, delta: number, reason: string): Promise<number> {
    const newScore = await this.prisma.$transaction(async tx => {
      const user = await this.reputationRepository.findUserScore(userId, tx);
      const current = user?.reputationScore ?? 0;
      const clamped = Math.max(0, Math.min(1000, current + delta));

      await this.reputationRepository.updateUserScore(userId, clamped, tx);
      await this.reputationRepository.createHistory(
        { userId, scoreChange: delta, reason, timestamp: new Date() },
        tx,
      );

      return clamped;
    });

    this.logger.log(
      `Reputation adjusted for user ${userId}: delta=${delta}, reason="${reason}", newScore=${newScore}`,
    );

    return newScore;
  }
}
