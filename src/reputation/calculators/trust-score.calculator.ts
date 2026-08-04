// Trust Score Calculator
// Calculates a creator's trust score based on successful projects,
// milestone completion rate, and funds distribution.
//
// Accepts PrismaService (which extends PrismaClient) or any compatible
// Prisma client — used directly by ReputationService inside a transaction.

import { PrismaClient } from '@prisma/client';
import {
  ProjectRepository,
  MilestoneRepository,
} from '../../common/repositories';
import { PrismaService } from '../../prisma.service';

export async function calculateTrustScore(
  prisma: PrismaClient | PrismaService,
  creatorId: string,
): Promise<number> {
  // 1. Number of successful projects
  const successfulProjects = await (prisma as any).project.count({
    where: { creatorId, status: 'COMPLETED' },
  });

  // 2. Milestone stats
  const milestones = await (prisma as any).milestone.findMany({
    where: { project: { creatorId } },
    select: { status: true, createdAt: true, completionDate: true },
  });
  const totalMilestones: number = milestones.length;
  const completedOnTime: number = milestones.filter(
    (m: any) => m.status === 'APPROVED' && m.completionDate && m.completionDate <= m.createdAt,
  ).length;
  const failedMilestones: number = milestones.filter(
    (m: any) => m.status === 'REJECTED',
  ).length;

  // 3. Funds stats
  const projects = await (prisma as any).project.findMany({
    where: { creatorId },
    select: { goal: true, currentFunds: true },
  });
  const totalRaised: number = projects.reduce(
    (sum: number, p: any) => sum + Number(p.goal),
    0,
  );
  const totalDistributed: number = projects.reduce(
    (sum: number, p: any) => sum + Number(p.currentFunds),
    0,
  );

  // Scoring
  let score = 500;
  score += successfulProjects * 100;
  score += completedOnTime * 50;
  score -= failedMilestones * 75;
  score += totalRaised > 0 ? Math.round((totalDistributed / totalRaised) * 200) : 0;
  score = Math.max(0, Math.min(1000, score));
  return score;
}
