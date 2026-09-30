import { Module } from '@nestjs/common';
import { CommoditiesModule } from 'src/commodities/commodities.module';
import { DatabaseModule } from 'src/database/database.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [DatabaseModule, CommoditiesModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
