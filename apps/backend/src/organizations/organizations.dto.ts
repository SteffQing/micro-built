import type { OrganizationStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MonthDto {
  @ApiProperty({ example: '2026-10', description: 'YYYY-MM' })
  ym: string;

  @ApiProperty({ example: 'OCTOBER 2026' })
  label: string;
}

export class UnlockedVariationDto extends MonthDto {
  @ApiProperty()
  variationId: string;

  @ApiProperty({ example: 2, description: 'File version (each generation adds one)' })
  version: number;

  @ApiProperty({ description: 'When it was last generated' })
  updatedAt: Date;

  @ApiProperty({
    description:
      'Generated before the organization’s previous month last locked or was reverted: its amounts may be stale, so ' +
      'generate it again (PLAN_V2 R3)',
  })
  regenerateHint: boolean;
}

export class OrganizationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'NPF' })
  name: string;

  @ApiProperty({ example: 120, description: 'Customers whose payroll record is in it' })
  customers: number;

  @ApiProperty({ example: 37, description: 'DISBURSED loans of those customers' })
  runningLoans: number;

  @ApiProperty({
    type: MonthDto,
    nullable: true,
    description: 'The latest month whose variation is locked (a voucher, or no payroll); null before the first',
  })
  latestLocked: MonthDto | null;

  @ApiProperty({ type: [UnlockedVariationDto], description: 'Variations waiting for their voucher, in month order' })
  unlocked: UnlockedVariationDto[];

  @ApiProperty({ description: 'Whether any of its loans has a deduction in the current Lagos month' })
  deductionsThisMonth: boolean;

  @ApiProperty({
    enum: ['ACTIVE', 'PENDING'],
    description:
      'PENDING: an admin or marketer named it and a super admin hasn’t approved it yet. Its customers are in it, but ' +
      'no variation is generated for it until it is approved (or merged into the organization it misspelt).',
  })
  status: OrganizationStatus;

  @ApiProperty({ type: String, nullable: true, example: 'Ada Obi', description: 'Who named it, while PENDING' })
  requestedBy: string | null;
}

export class MergeOrganizationsDto {
  @ApiProperty({ description: 'The organization that stays; this one goes into it' })
  @IsString()
  @IsNotEmpty()
  intoId: string;
}

export class MergedOrganizationsDto {
  @ApiProperty()
  intoId: string;

  @ApiProperty({ example: 12, description: 'Payroll records moved into it' })
  movedPayrolls: number;

  @ApiProperty({ example: 2, description: 'Variations (with their vouchers) moved into it' })
  movedVariations: number;
}

/** POST /admin/organizations, PATCH /admin/organizations/:id */
export class OrganizationNameDto {
  @ApiProperty({ example: 'Nigerian Navy', description: 'Spaces are tidied; names are matched ignoring case' })
  @IsString()
  @IsNotEmpty({ message: 'Enter the organization’s name' })
  @MaxLength(120)
  name: string;
}
