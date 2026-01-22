import { IsString, IsNumber, IsDate, IsNotEmpty, Min } from 'class-validator';

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  coverageType: string;

  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @IsDate()
  @IsNotEmpty()
  endDate: Date;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  premium: number;
}
