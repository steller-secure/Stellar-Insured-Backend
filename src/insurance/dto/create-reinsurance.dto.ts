import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';

export class CreateReinsuranceDto {
  @ApiProperty({ description: 'Insurance pool ID' })
  @IsString()
  poolId: string;

  @ApiProperty({ description: 'Coverage limit for the contract' })
  @Transform(({ value }) => {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lte(new Prisma.Decimal(0))) {
      throw new Error('Coverage limit must be positive');
    }
    return decimal;
  })
  coverageLimit: Prisma.Decimal;

  @ApiProperty({
    description: 'Premium rate expressed as a decimal between 0 and 1',
    minimum: 0,
    maximum: 1,
  })
  @Transform(({ value }) => {
    const decimal = new Prisma.Decimal(value);
    if (
      decimal.lt(new Prisma.Decimal(0)) ||
      decimal.gt(new Prisma.Decimal(1))
    ) {
      throw new Error('Premium rate must be between 0 and 1');
    }
    return decimal;
  })
  premiumRate: Prisma.Decimal;
}
