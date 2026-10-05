import { Module } from '@nestjs/common';
import { AuditModule } from 'src/audit/audit.module';
import { DatabaseModule } from 'src/database/database.module';
import { CommoditiesController } from './commodities.controller';
import { CommoditiesService } from './commodities.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [CommoditiesController],
  providers: [CommoditiesService],
  exports: [CommoditiesService],
})
export class CommoditiesModule {}
