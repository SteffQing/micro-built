import { randomBytes } from 'node:crypto';
import { PDFDocument } from '@cantoo/pdf-lib';
import * as officeCrypto from 'officecrypto-tool';
import type { DocumentFormat, ReportAudience } from 'src/common/types/queue.interface';

/**
 * Whether a file is password-protected (it opens with the customer ID).
 * - A customer downloading their own copy: yes unless they turn it off (`requested === false`); it's theirs to share.
 * - A customer's copy an admin sends: always (it may be forwarded, e.g. to another lender).
 * - An admin's internal copy: only when asked for.
 */
export function shouldProtect(audience: ReportAudience, requested: boolean | undefined, ownCopy = false): boolean {
  if (ownCopy) return requested !== false;
  return audience === 'customer' || requested === true;
}

/**
 * Password-protects a rendered statement/report so it only opens with `password` (the customer ID).
 * Runs on the finished bytes, so the renderers stay unaware of it.
 *
 * PDF: AES-256 with that password to open. The owner password is random and thrown away: nobody needs
 * to lift the restrictions, and reusing the open password would hand out owner access.
 * XLSX: ECMA-376 (Office) encryption; Excel, Numbers and LibreOffice all prompt for it.
 */
export async function protectDocument(body: Buffer, format: DocumentFormat, password: string): Promise<Buffer> {
  if (format === 'xlsx') return officeCrypto.encrypt(body, { password });

  const pdf = await PDFDocument.load(body);
  pdf.encrypt({
    userPassword: password,
    ownerPassword: randomBytes(24).toString('base64url'),
    permissions: { printing: 'highResolution', copying: true, modifying: false, annotating: false },
  });
  return Buffer.from(await pdf.save());
}
