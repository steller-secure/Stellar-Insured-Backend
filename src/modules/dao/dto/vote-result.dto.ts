import { ApiProperty } from '@nestjs/swagger';

export class VotePercentagesDto {
  @ApiProperty({ example: 60.5 })
  for: number;

  @ApiProperty({ example: 30.0 })
  against: number;

  @ApiProperty({ example: 9.5 })
  abstain: number;
}

export class VoteResultDto {
  @ApiProperty()
  proposalId: string;

  @ApiProperty()
  totalVotes: number;

  @ApiProperty()
  forVotes: number;

  @ApiProperty()
  againstVotes: number;

  @ApiProperty()
  abstainVotes: number;

  @ApiProperty({ type: VotePercentagesDto })
  percentages: VotePercentagesDto;

  @ApiProperty({
    description: 'Whether the proposal has reached the minimum vote threshold',
  })
  hasQuorum: boolean;

  @ApiProperty({ description: 'Minimum votes required for quorum' })
  quorumThreshold: number;
}
