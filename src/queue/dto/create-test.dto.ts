import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateTestDto {
  @ApiProperty({ description: 'message to send', example: 'Hello World' })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'number of times to send this message',
    example: 5,
  })
  @IsInt()
  @Min(1)
  count: number;
}
