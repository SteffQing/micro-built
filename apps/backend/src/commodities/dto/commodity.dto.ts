import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommodityDto {
  @ApiProperty({ example: 'solar panel', description: 'Saved in Title Case ("Solar Panel")' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;
}

export class UpdateCommodityDto {
  @ApiProperty({ example: false, description: 'false hides it from customers; commodities are never deleted' })
  @IsBoolean()
  active: boolean;
}

export class CommodityDto {
  @ApiProperty({ example: 'cmg0f8x2k0000a1b2c3d4e5f6' })
  id: string;

  @ApiProperty({ example: 'Solar Panel' })
  name: string;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ example: '2026-09-30T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({
    example: false,
    required: false,
    description: 'List only: an asset request uses it, so it can be hidden but not deleted',
  })
  inUse?: boolean;
}
