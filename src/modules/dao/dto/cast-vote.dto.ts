import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { VoteType } from '../enums/vote-type.enum';

export class CastVoteDto {
  @ApiProperty({
    enum: VoteType,
    example: VoteType.FOR,
    description: 'The type of vote: FOR, AGAINST, or ABSTAIN',
  })
  @IsNotEmpty()
  @IsEnum(VoteType)
  voteType: VoteType;
}
