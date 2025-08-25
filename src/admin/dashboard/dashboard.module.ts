import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ConfigModule } from 'src/config/config.module';
import { CustomersModule } from '../customers/customers.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  imports: [DatabaseModule, ConfigModule, CustomersModule],
})
export class DashboardModule {}
