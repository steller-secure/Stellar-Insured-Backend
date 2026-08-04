import { Injectable } from '@nestjs/common';
import { Project, Contribution, Milestone, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { TransactionClient } from '../repositories/repository.interface';

// ─── ProjectRepository ───────────────────────────────────────────────────────

@Injectable()
export class ProjectRepository extends SoftDeleteRepository<Project> {
  constructor(prisma: PrismaService) {
    super(prisma, 'project');
  }

  async findByContractId(contractId: string, tx?: TransactionClient): Promise<Project | null> {
    return this.delegate(tx).findUnique({ where: { contractId } });
  }

  async upsertByContractId(
    contractId: string,
    create: Prisma.ProjectUncheckedCreateInput,
    update: Prisma.ProjectUncheckedUpdateInput,
    tx?: TransactionClient,
  ): Promise<Project> {
    return this.delegate(tx).upsert({
      where: { contractId },
      create,
      update,
    });
  }

  async updateManyByContractId(
    contractId: string,
    data: Prisma.ProjectUpdateManyMutationInput,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return this.delegate(tx).updateMany({ where: { contractId }, data });
  }

  async updateById(
    id: string,
    data: Prisma.ProjectUncheckedUpdateInput,
    tx?: TransactionClient,
  ): Promise<Project> {
    return this.delegate(tx).update({ where: { id }, data });
  }

  async countCompleted(creatorId: string, tx?: TransactionClient): Promise<number> {
    return this.delegate(tx).count({ where: { creatorId, status: 'COMPLETED' } });
  }

  async findByCreatorWithFunds(
    creatorId: string,
    tx?: TransactionClient,
  ): Promise<Pick<Project, 'goal' | 'currentFunds'>[]> {
    return this.delegate(tx).findMany({
      where: { creatorId },
      select: { goal: true, currentFunds: true },
    });
  }
}

// ─── ContributionRepository ──────────────────────────────────────────────────

@Injectable()
export class ContributionRepository extends SoftDeleteRepository<Contribution> {
  constructor(prisma: PrismaService) {
    super(prisma, 'contribution');
  }

  async upsertByTxHash(
    transactionHash: string,
    create: Prisma.ContributionUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<Contribution> {
    return this.delegate(tx).upsert({
      where: { transactionHash },
      update: {},
      create,
    });
  }

  async findDistinctInvestors(
    projectId: string,
    tx?: TransactionClient,
  ): Promise<{ investorId: string }[]> {
    return this.delegate(tx).findMany({
      where: { projectId },
      select: { investorId: true },
      distinct: ['investorId'],
    });
  }
}

// ─── MilestoneRepository ─────────────────────────────────────────────────────

@Injectable()
export class MilestoneRepository extends SoftDeleteRepository<Milestone> {
  constructor(prisma: PrismaService) {
    super(prisma, 'milestone');
  }

  async updateManyByProject(
    projectId: string,
    data: Prisma.MilestoneUpdateManyMutationInput,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return this.delegate(tx).updateMany({ where: { projectId }, data });
  }

  async findByCreator(
    creatorId: string,
    tx?: TransactionClient,
  ): Promise<Pick<Milestone, 'status' | 'createdAt' | 'completionDate'>[]> {
    return this.delegate(tx).findMany({
      where: { project: { creatorId } },
      select: { status: true, createdAt: true, completionDate: true },
    });
  }
}
