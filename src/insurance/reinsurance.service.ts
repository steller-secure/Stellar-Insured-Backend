import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from './services/audit.service';
import { ReinsuranceContractRepository } from '../common/repositories/reinsurance-contract.repository';

@Injectable()
export class ReinsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly reinsuranceRepository: ReinsuranceContractRepository,
  ) {}

  async createContract(poolId: string, coverageLimit: Prisma.Decimal, premiumRate: Prisma.Decimal) {
    return await this.prisma.$transaction(async tx => {
      const contract = await this.reinsuranceRepository.createContract(
        { poolId, coverageLimit, premiumRate },
        tx,
      );
      await this.auditService.logCreate('ReinsuranceContract', contract.id, contract, undefined, undefined, tx);
      return contract;
    });
  }

  async releaseContract(contractId: string) {
    return await this.prisma.$transaction(async tx => {
      const existing = await this.reinsuranceRepository.findByIdStrict(contractId, tx);
      if (!existing) {
        throw new BadRequestException(`Reinsurance contract ${contractId} not found`);
      }
      // If contract is already released (deleted), check if it's already been processed (idempotent operation)
      // Since we're using soft delete, if deletedAt is not null, the contract is already released
      if (existing.deletedAt) {
        return existing;
      }
      const beforeState = { ...existing };
      const released = await this.reinsuranceRepository.deleteContract(contractId, tx);
      await this.auditService.logDelete(
        'ReinsuranceContract',
        contractId,
        beforeState,
        undefined,
        'Reinsurance contract released',
        tx,
      );
      return released;
    });
  }
}