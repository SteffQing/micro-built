import { ApiProperty } from '@nestjs/swagger';
import { RepaymentStatus } from '@prisma/client';

export class RepaymentOverviewDto {
  @ApiProperty({ example: 150000 })
  totalExpected: number;

  @ApiProperty({ example: 90000 })
  totalRepaid: number;

  @ApiProperty({ example: 2 })
  underpaymentsCount: number;

  @ApiProperty({ example: 1 })
  failedDeductionsCount: number;
}

export class RepaymentsResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  period: string;

  @ApiProperty({ example: 25000 })
  expectedAmount: number;

  @ApiProperty({ example: 20000 })
  repaidAmount: number;

  @ApiProperty({ enum: RepaymentStatus })
  status: RepaymentStatus;
}

export class SingleRepaymentWithUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  period: string;

  @ApiProperty()
  expectedAmount: number;

  @ApiProperty()
  repaidAmount: number;

  @ApiProperty({ enum: RepaymentStatus })
  status: RepaymentStatus;

  @ApiProperty()
  userName: string;
}
