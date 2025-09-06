import * as generateId from './generate-id';
import * as generateCode from './generate-code';
import {
  updateLoansAndConfigs,
  calculateActiveLoanRepayment,
  calculateThisMonthPayment,
  parseDateToPeriod,
  parsePeriodToDate,
} from './shared-repayment.logic';
import { enumToHumanReadable, formatDateToReadable } from './strings';

const chunkArray = <T>(array: T[], size: number = 100): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export {
  generateId,
  generateCode,
  chunkArray,
  updateLoansAndConfigs,
  calculateActiveLoanRepayment,
  calculateThisMonthPayment,
  parseDateToPeriod,
  parsePeriodToDate,
  enumToHumanReadable,
  formatDateToReadable,
};
