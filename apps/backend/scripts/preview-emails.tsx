// Renders every email template with sample props to HTML files, for eyeballing in a browser.
//
//   pnpm --filter @microbuilt/backend exec tsx scripts/preview-emails.tsx [outDir]
//
// outDir defaults to ./email-previews (relative to where you run it; git-ignored in apps/backend). Nothing is sent.

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { render } from '@react-email/render';
import * as React from 'react';
import AdminInviteEmail from '../src/notifications/templates/AdminInvite';
import AuthCodeEmail from '../src/notifications/templates/AuthCode';
import CustomerImportEmail from '../src/notifications/templates/CustomerImport';
import CustomerNotificationEmail from '../src/notifications/templates/CustomerNotification';
import CustomerOnboardEmail from '../src/notifications/templates/CustomerOnboard';
import MagicLinkEmail from '../src/notifications/templates/MagicLink';
import { RepaymentScheduleEmail } from '../src/notifications/templates/RepaymentSchedule';
import PasswordResetEmail from '../src/notifications/templates/ResetPassword';

const previews: Record<string, React.ReactElement> = {
  'admin-invite': AdminInviteEmail({
    name: 'Adaeze Okafor',
    email: 'adaeze.okafor.long-address@microbuiltprime.com',
    password: 'Tmp#9xQ2vLm4Wz8RkPa7',
    adminId: 'ADM-2026-00417',
    role: 'ADMIN',
  }),
  'auth-code': AuthCodeEmail({
    heading: 'Verify your email',
    intro: 'Use this code to verify your email address and finish setting up your MicroBuilt account.',
    code: '482913',
    expiresInMinutes: 10,
    userName: 'Adaeze',
  }),
  'customer-import': CustomerImportEmail({
    name: 'Adaeze',
    total: 120,
    imported: 117,
    failed: 3,
    skipped: 2,
    errors: [
      'Row 12 (Jane Doe): phone number is invalid',
      'Row 40 (John Smith): IPPIS number already registered',
      'Row 77 (Ngozi Eze): missing salary',
    ],
    moreErrors: 0,
  }),
  'customer-notification': CustomerNotificationEmail({
    name: 'Chidi',
    title: 'Your loan has been approved',
    message: 'Your loan request of NGN 250,000 has been approved and will be disbursed shortly.',
    ctaUrl: 'https://microbuiltprime.com/dashboard/loans',
    ctaText: 'View loan',
  }),
  'customer-onboard': CustomerOnboardEmail({
    name: 'Chidi Nwosu',
    email: 'chidi.nwosu.with.a.very.long.address@example.com',
    phone: '+2348012345678',
    password: 'Tmp#7Hn3Qw9ZsLd2Vx',
  }),
  'magic-link': MagicLinkEmail({
    url: 'https://api.microbuiltprime.com/api/auth/magic-link/verify?token=abcdefghijklmnopqrstuvwxyz0123456789&callbackURL=%2Fdashboard',
    expiresInMinutes: 15,
  }),
  'repayment-schedule': RepaymentScheduleEmail({
    month: 'October 2026',
    totalCustomers: 84,
    totalAmount: '₦3,412,500.00',
    variationId: 'VAR-2026-10-001',
    draft: false,
  }),
  'reset-password': PasswordResetEmail({
    resetUrl: 'https://microbuiltprime.com/reset-password?token=abcdefghijklmnopqrstuvwxyz0123456789',
    userName: 'Adaeze',
  }),
};

async function main() {
  const outDir = resolve(process.argv[2] ?? './email-previews');
  await mkdir(outDir, { recursive: true });
  for (const [name, email] of Object.entries(previews)) {
    const html = await render(email);
    await writeFile(join(outDir, `${name}.html`), html);
    console.log(`${name}.html (${html.length} bytes)`);
  }
  console.log(`Wrote ${Object.keys(previews).length} previews to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
