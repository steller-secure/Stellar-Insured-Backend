import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { calculateTrustScore } from './calculators/trust-score.calculator';

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recomputes the trust score from on-chain project / milestone data and
   * persists it on the user record.  This is the existing behaviour – kept
   * unchanged so all existing callers continue to work.
   */
  async updateTrustScore(userId: string): Promise<number> {
    const score = await calculateTrustScore(this.prisma, userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { trustScore: score },
    });
    return score;
  }

  /**
   * Applies a signed integer delta to `User.reputationScore` and writes a
   * `ReputationHistory` row so every change is fully auditable.
   *
   * The score is clamped to [0, 1000] after the adjustment so it can never
   * go negative or overflow the column.
   *
   * @param userId  The user whose reputation is being adjusted.
   * @param delta   Positive value to increase, negative to decrease.
   * @param reason  Human-readable description recorded in ReputationHistory.
   * @returns       The new clamped reputationScore.
   */
  async adjustReputation(
    userId: string,
    delta: number,
    reason: string,
  ): Promise<number> {
    const newScore = await this.prisma.$transaction(async tx => {
      // Read current score inside the transaction to avoid a race condition.
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { reputationScore: true },
      });

      const current = user?.reputationScore ?? 0;
      const clamped = Math.max(0, Math.min(1000, current + delta));

      await tx.user.update({
        where: { id: userId },
        data: { reputationScore: clamped },
      });

      await tx.reputationHistory.create({
        data: {
          userId,
          scoreChange: delta,
          reason,
          timestamp: new Date(),
        },
      });

      return clamped;
    });

    this.logger.log(
      `Reputation adjusted for user ${userId}: delta=${delta}, reason="${reason}", newScore=${newScore}`,
    );

    return newScore;
  }
}
