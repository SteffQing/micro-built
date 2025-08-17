import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class UploadRepaymentQueueDto {
  @ApiProperty({
    description: 'Uploaded xlsx file to supabase ~ url',
    example:
      'https://hlvusfvooxvhazayudnt.supabase.co/storage/v1/object/public/user-avatar/2025/APRIL',
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Period for repayment batch',
    example: 'APRIL 2025',
  })
  @IsString()
  period: string;
}
