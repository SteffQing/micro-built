import { Module } from '@nestjs/common';
import { AuditModule } from 'src/audit/audit.module';
import { DatabaseModule } from 'src/database/database.module';
import { CalloutsAdminController, CalloutsController } from './callouts.controller';
import { CalloutsService } from './callouts.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [CalloutsController, CalloutsAdminController],
  providers: [CalloutsService],
})
export class CalloutsModule {}
