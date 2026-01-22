import { IsNotEmpty, IsString } from 'class-validator';
import { LoginChallengeDto } from './login-challenge.dto';

export class LoginDto extends LoginChallengeDto {
  @IsNotEmpty()
  @IsString()
  signature: string;
}
