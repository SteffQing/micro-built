import { Module } from '@nestjs/common';
import { AuditModule } from 'src/audit/audit.module';
import { CommoditiesModule } from 'src/commodities/commodities.module';
import { DatabaseModule } from 'src/database/database.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [DatabaseModule, AuditModule, CommoditiesModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
