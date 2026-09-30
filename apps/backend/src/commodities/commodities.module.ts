import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { CommoditiesController } from './commodities.controller';
import { CommoditiesService } from './commodities.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CommoditiesController],
  providers: [CommoditiesService],
  exports: [CommoditiesService],
})
export class CommoditiesModule {}
