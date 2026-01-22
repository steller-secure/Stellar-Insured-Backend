import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginChallengeDto {
  @IsNotEmpty()
  @IsString()
  @Length(56, 56)
  @Matches(/^G[A-Z0-9]{55}$/, { message: 'Invalid Stellar wallet address' })
  walletAddress: string;
}
