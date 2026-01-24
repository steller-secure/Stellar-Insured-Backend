import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LoginChallengeDto } from './login-challenge.dto';

export class LoginDto extends LoginChallengeDto {
  @ApiProperty({
    description: 'Signature of the challenge message',
    example: 'base64_encoded_signature',
  })
  @IsNotEmpty()
  @IsString()
  signature: string;
}
