import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsArray,
  IsOptional,
  Matches,
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
  @Matches(/^\d{10}$/, { message: 'Phone number must be 11 digits' })
  nextOfKinContact: string;

  @ApiProperty({
    description: 'User gender',
    example: 'Male',
  })
  @IsString()
  @IsNotEmpty()
  gender: 'Male' | 'Female';
}

export class UpdateIdentityDto {
  @ApiPropertyOptional({
    description: 'Date of birth',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Array of document URLs or identifiers',
    example: ['passport.pdf', 'bank_statement.pdf'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];

  @ApiPropertyOptional({
    description: 'Residential address',
    example: '123 Main Street, Lagos',
  })
  @IsOptional()
  @IsString()
  residencyAddress?: string;

  @ApiPropertyOptional({
    description: 'State of residency',
    example: 'Lagos',
  })
  @IsOptional()
  @IsString()
  stateResidency?: string;

  @ApiPropertyOptional({
    description: 'Next of kin full name',
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  nextOfKinName?: string;

  @ApiPropertyOptional({
    description: 'Next of kin contact information',
    example: '08012345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Phone number must be 11 digits' })
  nextOfKinContact?: string;

  @ApiProperty({
    description: 'User gender',
    example: 'Male',
  })
  @IsString()
  @IsOptional()
  gender?: 'Male' | 'Female';
}

export class UserIdentityDto {
  @ApiPropertyOptional({
    description: 'Date of birth',
    example: '1990-01-01',
  })
  @IsDateString()
  dateOfBirth: string;

  @ApiPropertyOptional({
    description: 'Array of document URLs or identifiers',
    example: ['passport.pdf', 'bank_statement.pdf'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  documents: string[];

  @ApiPropertyOptional({
    description: 'Residential address',
    example: '123 Main Street, Lagos',
  })
  @IsString()
  residencyAddress: string;

  @ApiPropertyOptional({
    description: 'State of residency',
    example: 'Lagos',
  })
  @IsString()
  stateResidency: string;

  @ApiPropertyOptional({
    description: 'Next of kin full name',
    example: 'Jane Doe',
  })
  @IsString()
  nextOfKinName: string;

  @ApiPropertyOptional({
    description: 'Next of kin contact information',
    example: '08012345678',
  })
  @IsString()
  nextOfKinContact: string;

  @ApiProperty({
    description: 'User gender',
    example: 'Male',
  })
  @IsString()
  gender: 'Male' | 'Female';
}
