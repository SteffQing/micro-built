import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentInflowState } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiGenericErrorResponse } from 'src/common/decorators';
import { IsMoney } from 'src/common/dto';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
import { PROOF_MAX_BYTES } from 'src/common/logic/proof-file';

export class CreateLiquidationDto {
  @IsMoney({ description: 'Naira paid towards the loan', example: 150000 })
  amount: number;
}

export class LiquidationHistoryQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ enum: PaymentInflowState, description: 'Only requests in this state' })
  @IsOptional()
  @IsEnum(PaymentInflowState)
  state?: PaymentInflowState;
}

export class LiquidationPreviewDto {
  @ApiProperty({ example: 'LN-4KX9Q2' })
  loanId: string;

  @ApiProperty({ example: 240000 })
  owed: number;

  @ApiProperty({ example: 60000 })
  repaid: number;

  @ApiProperty({ example: 180000, description: 'The most a liquidation can pay now' })
  outstanding: number;

  @ApiProperty({ example: 0 })
  penaltyOutstanding: number;

  @ApiProperty({ example: 30000 })
  interestOutstanding: number;

  @ApiProperty({ example: 150000 })
  principalOutstanding: number;

  @ApiProperty({ example: 6 })
  remainingMonths: number;

  @ApiProperty({ example: 30000, nullable: true, type: Number, description: "This month's deduction" })
  monthly: number | null;

  @ApiProperty({ example: 'MARCH 2027', nullable: true, type: String, description: 'Last month at the current pace' })
  endPeriod: string | null;
}

export class LiquidationCreatedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ enum: PaymentInflowState, example: PaymentInflowState.AWAITING })
  state: PaymentInflowState;

  @ApiProperty({ type: String, format: 'date-time' })
  requestedAt: Date;
}

export class LiquidationHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ enum: PaymentInflowState, example: PaymentInflowState.AWAITING })
  state: PaymentInflowState;

  @ApiProperty({ type: String, format: 'date-time' })
  requestedAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When a super admin decided it' })
  decidedAt: Date | null;

  @ApiProperty({ type: String, nullable: true, description: "A rejection's reason" })
  note: string | null;

  @ApiProperty()
  hasProof: boolean;
}

export class ProofUrlDto {
  @ApiProperty({ description: 'Opens the proof; valid for expiresIn seconds' })
  url: string;

  @ApiProperty({ example: 300 })
  expiresIn: number;
}

/** Multipart `amount` + `proof` (PDF, JPG or PNG, at most 5 MB), sent direct to the API. */
export function ProofUpload() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['amount', 'proof'],
        properties: {
          amount: { type: 'number', example: 150000 },
          proof: { type: 'string', format: 'binary', description: 'PDF, JPG or PNG, at most 5 MB' },
        },
      },
    }),
    ApiGenericErrorResponse({
      code: 400,
      err: 'Bad Request',
      msg: 'Proof of payment must be a PDF, JPG or PNG file',
      desc: 'No proof, a proof of another type, or an invalid amount',
    }),
    ApiGenericErrorResponse({
      code: 409,
      err: 'Conflict',
      msg: 'There is no active loan to liquidate',
      desc: 'No running loan, or the amount is more than what is still owed',
    }),
    ApiGenericErrorResponse({ code: 413, err: 'Payload Too Large', msg: 'File too large', desc: 'Proof over 5 MB' }),
    UseInterceptors(FileInterceptor('proof', { limits: { fileSize: PROOF_MAX_BYTES } })),
  );
}
