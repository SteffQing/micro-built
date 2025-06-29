import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    // private readonly config: ConfigService,
  ) {}

  async overview() {
    return {};
  }
}
