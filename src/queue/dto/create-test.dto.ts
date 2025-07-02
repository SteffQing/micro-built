import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateTestDto {
  @ApiProperty({ description: 'message to send', example: 'Hello World' })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'priority of the task queue',
    example: 2,
    default: 2,
  })
  @IsInt()
  @Min(1)
  priority: number;

  @ApiProperty({
    description: 'foo - bar',
    default: 'bar',
  })
  @IsString()
  foo: string;

  @ApiProperty({
    description: 'number of times to send this message',
    example: 5,
  })
  @IsInt()
  @Min(1)
  count: number;
}
