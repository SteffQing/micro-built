import { IsString, IsDecimal, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';

export class CreatePayrollDto {
  @ApiProperty({
    description: 'IPPIS ID of the user. Maps to externalId on User table.',
    example: 'PF12033',
  })
  @IsString()
  externalId: string;

  @ApiProperty({
    description: 'The gross amount a user receives per month',
    example: '734920',
  })
  @IsNumber()
  employeeGross: number;

  @ApiProperty({
    description: "Employee's remaining salary after deductions",
    example: '120000.50',
  })
  @IsDecimal({ decimal_digits: '2', force_decimal: true })
  netPay: string;

  @ApiProperty({
    description: 'Employee grade level',
    example: 'Level 12',
  })
  @IsString()
  grade: string;

  @ApiProperty({
    description: 'Step within the employee grade',
    example: 3,
  })
  @IsNumber()
  @Type(() => Number)
  step: number;

  @ApiProperty({
    description: 'Employee command or unit',
    example: 'Lagos Command',
  })
  @IsString()
  command: string;
}

export class UpdatePayrollDto extends PartialType(
  OmitType(CreatePayrollDto, ['externalId'] as const),
) {}
