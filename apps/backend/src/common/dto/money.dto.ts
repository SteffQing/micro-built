import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, Max } from 'class-validator';

/** No single amount on the platform comes near this; anything above it is a typo. */
export const MAX_AMOUNT = 1_000_000_000;

interface MoneyFieldOptions {
  description?: string;
  example?: number;
  optional?: boolean;
}

/**
 * A naira amount in a request body or query: a positive number with at most 2 decimals (kobo).
 * Query strings and multipart fields arrive as text, so the value is converted first. Services
 * turn it into a Prisma.Decimal with money() (src/ledger/money.ts) before doing anything with
 * it; responses turn Decimals back into numbers with toNumber().
 */
export function IsMoney(options: MoneyFieldOptions = {}) {
  const doc = {
    type: Number,
    example: options.example ?? 50000,
    description: options.description,
    minimum: 0.01,
    maximum: MAX_AMOUNT,
  };
  return applyDecorators(
    options.optional ? ApiPropertyOptional(doc) : ApiProperty(doc),
    ...(options.optional ? [IsOptional()] : []),
    Type(() => Number),
    IsNumber(
      { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
      { message: '$property must be an amount in naira with at most 2 decimals' },
    ),
    IsPositive({ message: '$property must be more than zero' }),
    Max(MAX_AMOUNT, { message: `$property can't be more than ${MAX_AMOUNT}` }),
  );
}
