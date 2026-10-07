import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CalloutAudience, CalloutKind, CalloutStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * What fits a callout card, which is one fixed height whatever it says: the figure sits on the artwork, the title takes
 * two lines at most and the body four. invariants.sql holds the database to the same limits.
 */
export const CALLOUT_LIMITS = { title: 60, body: 160, highlight: 24 } as const;

/** Every callout but the pinned one is deleted this long after it's created (or last renewed). */
export const CALLOUT_LIFETIME_DAYS = 7;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCalloutDto {
  @ApiProperty({ enum: CalloutKind, example: 'EDUCATION', description: 'Sets its artwork and label' })
  @IsEnum(CalloutKind)
  kind: CalloutKind;

  @ApiProperty({ example: 'Pay early, pay less', maxLength: CALLOUT_LIMITS.title })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Give it a title' })
  @MaxLength(CALLOUT_LIMITS.title)
  title: string;

  @ApiProperty({
    example: 'An early payment lowers what you owe, so the deductions after it are smaller.',
    maxLength: CALLOUT_LIMITS.body,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Write what it says' })
  @MaxLength(CALLOUT_LIMITS.body)
  body: string;

  @ApiPropertyOptional({
    example: '48 hours',
    maxLength: CALLOUT_LIMITS.highlight,
    nullable: true,
    description: 'A figure or short phrase shown large; empty or null for none',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(CALLOUT_LIMITS.highlight)
  highlight?: string | null;

  @ApiProperty({ enum: CalloutAudience, isArray: true, example: ['CUSTOMER'], description: 'Who sees it' })
  @IsArray()
  @ArrayUnique()
  @IsEnum(CalloutAudience, { each: true })
  audience: CalloutAudience[];

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 2, description: '0 low, 1 normal (default), 2 high' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  priority?: number;

  @ApiPropertyOptional({ enum: CalloutStatus, example: 'DRAFT', description: 'DRAFT (default) or PUBLISHED' })
  @IsOptional()
  @IsEnum(CalloutStatus)
  status?: CalloutStatus;

  @ApiPropertyOptional({
    example: false,
    description:
      "Shown first to everyone in its audience, can't be dismissed, deleted or expire; pinning one unpins any other. " +
      'Only a published callout.',
  })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class UpdateCalloutDto extends PartialType(CreateCalloutDto) {
  @ApiPropertyOptional({
    example: true,
    description: `Starts its ${CALLOUT_LIFETIME_DAYS} days again from now`,
  })
  @IsOptional()
  @IsBoolean()
  renew?: boolean;
}

export class ViewerCalloutsQueryDto {
  @ApiPropertyOptional({
    example: 'cmg0f8x2k0000a1b2c3d4e5f6,cmg0f8x2k0000a1b2c3d4e5f7',
    description: 'Comma-separated ids the viewer dismissed in this browser; the next eligible ones fill their place',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  exclude?: string;
}

/** What a viewer's sidebar shows. */
export class ViewerCalloutDto {
  @ApiProperty({ example: 'cmg0f8x2k0000a1b2c3d4e5f6' })
  id: string;

  @ApiProperty({ enum: CalloutKind, example: 'EDUCATION' })
  kind: CalloutKind;

  @ApiProperty({ example: 'Pay early, pay less' })
  title: string;

  @ApiProperty({ example: 'An early payment lowers what you owe, so the deductions after it are smaller.' })
  body: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  highlight: string | null;

  @ApiProperty({ example: false })
  pinned: boolean;
}

/** The management page's row. */
export class CalloutDto extends ViewerCalloutDto {
  @ApiProperty({ enum: CalloutAudience, isArray: true, example: ['CUSTOMER', 'MARKETER'] })
  audience: CalloutAudience[];

  @ApiProperty({ example: 1, description: '0 low, 1 normal, 2 high' })
  priority: number;

  @ApiProperty({ enum: CalloutStatus, example: 'PUBLISHED' })
  status: CalloutStatus;

  @ApiProperty({ example: '2026-10-14T09:00:00.000Z', nullable: true, type: Date })
  publishedAt: Date | null;

  @ApiProperty({
    example: '2026-10-21T09:00:00.000Z',
    nullable: true,
    type: Date,
    description: `When it is deleted (${CALLOUT_LIFETIME_DAYS} days after it was created or last renewed); null while pinned`,
  })
  expiresAt: Date | null;

  @ApiProperty({ example: 'Ada Obi' })
  createdBy: string;

  @ApiProperty({ example: '2026-10-14T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-14T09:00:00.000Z' })
  updatedAt: Date;
}
