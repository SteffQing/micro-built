import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';

export class CreatePayrollDto {
  @ApiProperty({
    description: 'IPPIS ID of the user. Maps to externalId on User table',
    example: 'PF12033',
  })
  @IsString()
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
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  step?: number;

  @ApiProperty({
    description: 'Employee command or unit',
    example: 'Lagos Command',
  })
  @IsString()
  command: string;

  @ApiProperty({
    description: 'Employee organization',
    example: 'NPF',
  })
  @IsString()
  organization: string;
}

export class UpdatePayrollDto extends PartialType(
  OmitType(CreatePayrollDto, ['externalId'] as const),
) {}
