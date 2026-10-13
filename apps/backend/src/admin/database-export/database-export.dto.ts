import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestDatabaseExportDto {
  @ApiProperty({ example: 'Quarterly offline backup for the auditors', description: 'Kept in the audit log and in the file' })
  @Transform(({ value }: { value?: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5, { message: 'Say why the database is being exported' })
  @MaxLength(300)
  reason: string;

  @ApiProperty({
    example: 'correct horse battery staple',
    description: 'The file opens only with this password. Never stored or logged: keep it somewhere safe',
  })
  @IsString()
  @MinLength(12, { message: 'Use a password of at least 12 characters' })
  @MaxLength(128)
  password: string;
}

export class DatabaseExportQueuedDto {
  @ApiProperty({ example: 'DBX-7Q2LX0', description: 'The export’s reference in the audit log' })
  exportId: string;
}
