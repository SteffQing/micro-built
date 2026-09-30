import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
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
  @IsPhoneNumber('NG')
  @IsNotEmpty()
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

export class UpdateIdentityDto extends PartialType(CreateIdentityDto) { }
