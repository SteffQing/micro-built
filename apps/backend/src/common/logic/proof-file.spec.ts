import { BadRequestException } from '@nestjs/common';
import { PROOF_MAX_BYTES, proofType } from './proof-file';

const file = (bytes: number[], size = bytes.length) => ({ buffer: Buffer.from(bytes), size });

describe('proofType', () => {
  it.each([
    ['pdf', [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], 'application/pdf'],
    ['png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00], 'image/png'],
    ['jpg', [0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'],
  ])('reads a %s from its first bytes', (ext, bytes, mime) => {
    expect(proofType(file(bytes))).toEqual({ ext, mime });
  });

  it('refuses a renamed file of another kind', () => {
    expect(() => proofType(file([0x50, 0x4b, 0x03, 0x04]))).toThrow('must be a PDF, JPG or PNG');
  });

  it('refuses no file and an empty one', () => {
    expect(() => proofType(undefined)).toThrow(BadRequestException);
    expect(() => proofType(file([]))).toThrow('Attach proof of payment');
  });

  it('refuses more than 5 MB', () => {
    expect(() => proofType(file([0x25, 0x50, 0x44, 0x46, 0x2d], PROOF_MAX_BYTES + 1))).toThrow('5 MB or smaller');
  });
});
