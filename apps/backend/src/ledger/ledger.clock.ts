import { Injectable } from '@nestjs/common';

/** The ledger's notion of "now", so tests can run whole payroll cycles in any month. */
@Injectable()
export class LedgerClock {
  now(): Date {
    return new Date();
  }
}
