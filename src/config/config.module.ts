import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
  imports: [PrismaModule],
})
export class ConfigModule {}
