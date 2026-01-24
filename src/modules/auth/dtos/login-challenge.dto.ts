import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginChallengeDto {
  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{56}$/, {
    message: 'Invalid Stellar public key format',
  })
  walletAddress: string;
}
