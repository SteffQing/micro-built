import { Controller } from '@nestjs/common';
import { ReconcilationService } from './reconcilation.service';

@Controller('reconcilation')
export class ReconcilationController {
  constructor(private readonly reconcilationService: ReconcilationService) {}
}
