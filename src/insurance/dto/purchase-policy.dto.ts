import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { RiskType } from '../enums/risk-type.enum';

export class PurchasePolicyDto {
  @ApiProperty({ description: 'ID of the purchasing user' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Insurance pool ID' })
  @IsString()
  poolId: string;

  @ApiProperty({
    description: 'Risk type for the insurance policy',
    enum: RiskType,
  })
  @IsEnum(RiskType)
  riskType: RiskType;

  @ApiProperty({ description: 'Requested coverage amount', minimum: 0.01 })
  @Transform(({ value }) => {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lte(new Prisma.Decimal(0))) {
      throw new Error('Coverage amount must be positive');
    }
    return decimal;
  })
  coverageAmount: Prisma.Decimal;
}
