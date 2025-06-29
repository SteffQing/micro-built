import { Module } from '@nestjs/common';
import { ReconcilationService } from './reconcilation.service';
import { ReconcilationController } from './reconcilation.controller';

@Module({
  controllers: [ReconcilationController],
  providers: [ReconcilationService],
})
export class ReconcilationModule {}
