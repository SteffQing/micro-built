import { BadRequestException } from '@nestjs/common';

// Proof of a liquidation payment (V2.MD Stage 6): a PDF, JPG or PNG up to 5 MB. The type comes
// from the file's first bytes, never from its name or the browser's Content-Type, so a renamed
// file of another kind is refused.

export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

export interface ProofType {
  ext: 'pdf' | 'jpg' | 'png';
  mime: 'application/pdf' | 'image/jpeg' | 'image/png';
}

const SIGNATURES: (ProofType & { magic: number[] })[] = [
  { ext: 'pdf', mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
];

export function proofType(file: Pick<Express.Multer.File, 'buffer' | 'size'> | undefined): ProofType {
  if (!file?.buffer?.length) throw new BadRequestException('Attach proof of payment (a PDF, JPG or PNG)');
  if (file.size > PROOF_MAX_BYTES || file.buffer.length > PROOF_MAX_BYTES) {
    throw new BadRequestException('Proof of payment must be 5 MB or smaller');
  }
  const match = SIGNATURES.find(({ magic }) => magic.every((byte, i) => file.buffer[i] === byte));
  if (!match) throw new BadRequestException('Proof of payment must be a PDF, JPG or PNG file');
  return { ext: match.ext, mime: match.mime };
}
