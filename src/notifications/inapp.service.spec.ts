import { Test, TestingModule } from '@nestjs/testing';
import { InappService } from './inapp.service';

describe('InappService', () => {
  let service: InappService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InappService],
    }).compile();

    service = module.get<InappService>(InappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
