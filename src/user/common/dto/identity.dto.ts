import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsArray,
  IsOptional,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIdentityDto {
  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Array of document URLs or identifiers',
    example: ['passport.pdf', 'bank_statement.pdf'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  documents: string[];

  @ApiProperty({
    description: 'Residential address',
    example: '123 Main Street, Lagos',
  })
  @IsString()
  @IsNotEmpty()
  residencyAddress: string;

  @ApiProperty({
    description: 'State of residency',
    example: 'Lagos',
  })
  @IsString()
  @IsNotEmpty()
  stateResidency: string;

  @ApiProperty({
    description: 'Next of kin full name',
    example: 'Jane Doe',
  })
  @IsString()
  @IsNotEmpty()
  nextOfKinName: string;

  @ApiProperty({
    description: 'Next of kin contact information',
    example: '08012345678',
  })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  nextOfKinContact: string;
}

export class UpdateIdentityDto {
  @ApiPropertyOptional({
    description: 'Date of birth',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Array of document URLs or identifiers',
    example: ['passport.pdf', 'bank_statement.pdf'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  documents?: string[];

  @ApiPropertyOptional({
    description: 'Residential address',
    example: '123 Main Street, Lagos',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  residencyAddress?: string;

  @ApiPropertyOptional({
    description: 'State of residency',
    example: 'Lagos',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  stateResidency?: string;

  @ApiPropertyOptional({
    description: 'Next of kin full name',
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nextOfKinName?: string;

  @ApiPropertyOptional({
    description: 'Next of kin contact information',
    example: '08012345678',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nextOfKinContact?: string;
}
