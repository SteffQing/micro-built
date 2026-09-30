import * as generateId from './generate-id';
import * as generateCode from './generate-code';
import {
  enumToHumanReadable,
  formatDateToReadable,
  formatCurrency,
  formatDateToDmy,
} from './strings';

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
  enumToHumanReadable,
  formatDateToReadable,
  formatCurrency,
  formatDateToDmy,
};
