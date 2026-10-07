import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
