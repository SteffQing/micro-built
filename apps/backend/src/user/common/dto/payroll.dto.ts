import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';

export class CreatePayrollDto {
  @ApiProperty({
    description: 'IPPIS number of the customer (stored as Customer.externalId)',
    example: 'PF12033',
  })
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ApiPropertyOptional({
    description: 'Employee grade level',
    example: 'Level 12',
  })
  @IsString()
  @IsOptional()
  grade?: string;

  @ApiPropertyOptional({
    description: 'Step within the employee grade',
    example: 3,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  step?: number;

  @ApiProperty({
    description: 'Employee command or unit',
    example: 'Lagos Command',
  })
  @IsString()
  @IsNotEmpty()
  command: string;

  @ApiProperty({
    description: 'Employee organization',
    example: 'NPF',
  })
  @IsString()
  @IsNotEmpty()
  organization: string;
}

export class UpdatePayrollDto extends PartialType(
  OmitType(CreatePayrollDto, ['externalId'] as const),
) {}
