import { Test, TestingModule } from '@nestjs/testing';
import { ReconcilationController } from './reconcilation.controller';
import { ReconcilationService } from './reconcilation.service';

describe('ReconcilationController', () => {
  let controller: ReconcilationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReconcilationController],
      providers: [ReconcilationService],
    }).compile();

    controller = module.get<ReconcilationController>(ReconcilationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
