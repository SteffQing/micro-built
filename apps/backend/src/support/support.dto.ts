import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportAudience, SupportRating, SupportRole, SupportStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** The chat's limits (CHAT_SUPPORT.md C7). invariants.sql holds the database to the character limits. */
export const SUPPORT_LIMITS = {
  /** A caller's message. */
  messageChars: 1000,
  /** A staff reply. */
  staffReplyChars: 4000,
  noteChars: 500,
  titleChars: 60,
  /** Messages the model gets as history. */
  historyMessages: 12,
  maxSteps: 4,
  maxOutputTokens: 600,
  visitorMessagesPerHour: 15,
  visitorConversationsPerDay: 3,
  customerMessagesPerDay: 40,
  staffMessagesPerDay: 150,
  pageSize: 20,
} as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToUndefined = ({ value }: { value: unknown }) => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed === '' ? undefined : trimmed;
};

export class SupportPageQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;
}

export class CreateSupportConversationDto {
  @ApiPropertyOptional({
    example: '0.AbCdEf…',
    description: 'Cloudflare Turnstile token. Required for visitors (signed out) when `turnstileRequired` is true.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  turnstileToken?: string;
}

export class SendSupportMessageDto {
  @ApiProperty({ example: 'msg_k2x9', description: "The client's id for the message (useChat's)" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id: string;

  @ApiProperty({ example: "What's my balance?", maxLength: SUPPORT_LIMITS.messageChars })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Write a message' })
  @MaxLength(SUPPORT_LIMITS.messageChars, {
    message: `Keep a message under ${SUPPORT_LIMITS.messageChars.toLocaleString('en')} characters`,
  })
  text: string;
}

export class SupportHandoffDto {
  @ApiPropertyOptional({ example: 'ada@example.com', description: 'A visitor gives this or `contactPhone`' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: 'Enter a valid phone number' })
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'My deduction for June looks wrong', maxLength: SUPPORT_LIMITS.noteChars })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(SUPPORT_LIMITS.noteChars)
  note?: string;
}

export class SupportRatingDto {
  @ApiProperty({ enum: ['UP', 'DOWN'], example: 'UP' })
  @IsIn(['UP', 'DOWN'])
  rating: SupportRating;
}

export class SupportLimitsDto {
  @ApiProperty({ example: SUPPORT_LIMITS.messageChars })
  messageChars: number;

  @ApiPropertyOptional({ example: 38, description: 'Signed-in callers: messages left today' })
  remainingToday?: number;
}

export class SupportSessionDto {
  @ApiProperty({ example: true, description: 'False: the frontend falls back to email (C14)' })
  enabled: boolean;

  @ApiProperty({ enum: SupportAudience, example: 'CUSTOMER' })
  audience: SupportAudience;

  @ApiProperty({ example: false, description: 'Deactivated, or a super admin without 2FA: no account lookups' })
  restricted: boolean;

  @ApiPropertyOptional({ example: 'Ada' })
  firstName?: string;

  @ApiProperty({ type: [String], example: ["What's my loan balance?", 'When is my next deduction?'] })
  suggestions: string[];

  @ApiProperty({ type: SupportLimitsDto })
  limits: SupportLimitsDto;

  @ApiProperty({ example: false, description: 'A new conversation needs a Turnstile token' })
  turnstileRequired: boolean;

  @ApiProperty({ example: true, description: 'Customers, marketers and visitors can pass a conversation to staff' })
  canHandoff: boolean;
}

export class SupportConversationDto {
  @ApiProperty({ example: 'cmg0f8x2k0000a1b2c3d4e5f6' })
  id: string;

  @ApiProperty({ example: "What's my balance?" })
  title: string;

  @ApiProperty({ enum: SupportStatus, example: 'AI' })
  status: SupportStatus;

  @ApiProperty({ enum: SupportAudience, example: 'CUSTOMER' })
  audience: SupportAudience;

  @ApiPropertyOptional({ type: Date, nullable: true })
  handedOffAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  closedAt: Date | null;

  @ApiProperty({ example: '2026-10-07T09:00:00.000Z' })
  lastMessageAt: Date;

  @ApiProperty({ example: '2026-10-07T09:00:00.000Z' })
  createdAt: Date;
}

export class SupportConversationRowDto {
  @ApiProperty({ example: 'cmg0f8x2k0000a1b2c3d4e5f6' })
  id: string;

  @ApiProperty({ example: "What's my balance?" })
  title: string;

  @ApiProperty({ enum: SupportStatus, example: 'HANDOFF' })
  status: SupportStatus;

  @ApiProperty({ example: '2026-10-07T09:00:00.000Z' })
  lastMessageAt: Date;

  @ApiProperty({ example: false, description: 'A staff reply not opened yet' })
  unread: boolean;
}

export class SupportMessageDto {
  @ApiProperty({ example: 'cmg0f8x2k0000a1b2c3d4e5f7' })
  id: string;

  @ApiProperty({ enum: SupportRole, example: 'AI' })
  role: SupportRole;

  @ApiProperty({ example: 'Your balance is **₦120,000.00**.' })
  body: string;

  @ApiPropertyOptional({ example: 'Tunde', description: "Staff messages: the staff member's first name" })
  authorName?: string;

  @ApiPropertyOptional({ enum: SupportRating, nullable: true })
  rating?: SupportRating | null;

  @ApiProperty({ example: false, description: 'Show the handoff card under this reply' })
  offerHandoff: boolean;

  @ApiProperty({ example: '2026-10-07T09:00:00.000Z' })
  createdAt: Date;
}

export class SupportThreadDto {
  @ApiProperty({ type: SupportConversationDto })
  conversation: SupportConversationDto;

  @ApiProperty({ type: [SupportMessageDto] })
  messages: SupportMessageDto[];
}

export class SupportRatingResultDto {
  @ApiProperty({ example: 'cmg0f8x2k0000a1b2c3d4e5f7' })
  id: string;

  @ApiProperty({ enum: SupportRating, example: 'UP' })
  rating: SupportRating;
}

// Staff (admin/support)

export const STAFF_STATUS_FILTERS = ['AI', 'HANDOFF', 'ASSIGNED', 'CLOSED'] as const;

export class StaffSupportQueryDto extends SupportPageQueryDto {
  @ApiPropertyOptional({ enum: STAFF_STATUS_FILTERS, example: 'HANDOFF' })
  @IsOptional()
  @IsEnum(SupportStatus)
  status?: SupportStatus;

  @ApiPropertyOptional({ enum: ['me'], example: 'me', description: 'Only conversations assigned to you' })
  @IsOptional()
  @IsIn(['me'])
  assignee?: 'me';

  @ApiPropertyOptional({ example: 'ada', description: 'Title, requester name or contact' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class StaffReplyDto {
  @ApiProperty({ example: 'Hi Ada, I have checked your June deduction…', maxLength: SUPPORT_LIMITS.staffReplyChars })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Write a reply' })
  @MaxLength(SUPPORT_LIMITS.staffReplyChars)
  text: string;
}

export class SupportAnalyticsQueryDto {
  @ApiProperty({ example: '2026-09-08', description: 'First Lagos day (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use a date like 2026-09-08' })
  from: string;

  @ApiProperty({ example: '2026-10-07', description: 'Last Lagos day; at most 90 days after `from`' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use a date like 2026-10-07' })
  to: string;
}

export class StaffRequesterDto {
  @ApiPropertyOptional({ example: 'Ada Obi' })
  name?: string;

  @ApiPropertyOptional({ example: 'CUSTOMER', description: 'Users: their role' })
  role?: string;

  @ApiPropertyOptional({ example: '/customers/cmg…', description: 'Users: their page in the app' })
  link?: string;

  @ApiPropertyOptional({ example: 'ada@example.com', description: "Visitors: the contact they left" })
  contact?: string;
}

export class StaffSupportRowDto {
  @ApiProperty({ example: 'cmg0f8x2k0000a1b2c3d4e5f6' })
  id: string;

  @ApiProperty({ example: 'My June deduction' })
  title: string;

  @ApiProperty({ enum: SupportStatus, example: 'HANDOFF' })
  status: SupportStatus;

  @ApiProperty({ type: StaffRequesterDto })
  requester: StaffRequesterDto;

  @ApiPropertyOptional({ example: { id: 'u1', name: 'Tunde' }, nullable: true })
  assignee: { id: string; name: string } | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  handedOffAt: Date | null;

  @ApiProperty({ example: '2026-10-07T09:00:00.000Z' })
  lastMessageAt: Date;

  @ApiProperty({ example: true })
  unread: boolean;
}

export class StaffSupportMessageDto extends SupportMessageDto {
  @ApiProperty({ type: [String], example: ['my_loan'], description: 'AI messages: the tools it called (names only)' })
  toolNames: string[];
}

export class StaffSupportThreadDto {
  @ApiProperty({ type: SupportConversationDto })
  conversation: SupportConversationDto & { assignee: { id: string; name: string } | null; contactEmail: string | null; contactPhone: string | null };

  @ApiProperty({ type: StaffRequesterDto })
  requester: StaffRequesterDto;

  @ApiProperty({ type: [StaffSupportMessageDto] })
  messages: StaffSupportMessageDto[];
}
