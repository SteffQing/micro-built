import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsArray,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Gender, MaritalStatus, Relationship } from '@prisma/client';

export class CreateIdentityDto {
  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({
    description: 'User first name according to submitted documents',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'User last name according to submitted documents',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({
    description: 'User contact information',
    example: '08012345678',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0(70|80|81|90|91)[0-9]{8}$/, {
    message:
      'Phone number must be a valid Nigerian mobile number (e.g., 08012345678)',
  })
  contact: string;

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
    description: 'Nearesr Landmark or Busstop to place of residency',
    example: 'Adjacent Crescent Moon Printing House, VI Lagos',
  })
  @IsString()
  @IsNotEmpty()
  landmarkOrBusStop: string;

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
  @Matches(/^0(70|80|81|90|91)[0-9]{8}$/, {
    message:
      'Phone number must be a valid Nigerian mobile number (e.g., 08012345678)',
  })
  nextOfKinContact: string;

  @ApiProperty({
    description: 'Next of kin home address',
    example: 'Iperu-Remo, Ogun state',
  })
  @IsString()
  @IsNotEmpty()
  nextOfKinAddress: string;

  @ApiProperty({
    description: 'Next of kin relation status',
    example: Relationship.Sibling,
    enum: Relationship,
  })
  @IsEnum(Relationship)
  nextOfKinRelationship: Relationship;

  @ApiProperty({
    description: 'User gender',
    example: Gender.Male,
    enum: Gender,
  })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({
    description: 'User marital status',
    example: MaritalStatus.Married,
    enum: MaritalStatus,
  })
  @IsEnum(MaritalStatus)
  maritalStatus: MaritalStatus;
}

export class UpdateIdentityDto extends PartialType(CreateIdentityDto) {}
