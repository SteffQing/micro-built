import type { TextStreamPart, ToolSet } from 'ai';
import { maskAccount, maskEmail, maskPhone, maskSensitive } from './redact';
import { scrub, splitSafe } from './scrub';

/** Runs text deltas through the transform and joins what comes out. */
async function scrubbed(deltas: string[]): Promise<string> {
  const transform = scrub<ToolSet>()();
  const writer = transform.writable.getWriter();
  const out: string[] = [];
  const reading = (async () => {
    const reader = transform.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value.type === 'text-delta') out.push(value.text);
    }
  })();
  for (const text of deltas) await writer.write({ type: 'text-delta', id: 't', text } as TextStreamPart<ToolSet>);
  await writer.write({ type: 'text-end', id: 't' } as TextStreamPart<ToolSet>);
  await writer.close();
  await reading;
  return out.join('');
}

describe('scrub', () => {
  it('masks a 10-digit run, an 11-digit run, an email and a phone number', async () => {
    expect(await scrubbed(['Account 0123456789 is yours.'])).toBe('Account ••••6789 is yours.');
    expect(await scrubbed(['BVN 22212345678.'])).toBe('BVN ••••5678.');
    expect(await scrubbed(['Write to ada.obi@example.com today'])).toBe('Write to a•••@example.com today');
    expect(await scrubbed(['Call +234 803 123 4567 now'])).toBe('Call +234•••••4567 now');
    expect(await scrubbed(['Call 0803-123-4567 now'])).toBe('Call 080•••••4567 now');
  });

  it('catches a number split across chunks', async () => {
    expect(await scrubbed(['Your number is 0803', ' 123', ' 4567', ' — correct?'])).toBe('Your number is 080•••••4567 — correct?');
    expect(await scrubbed(['acct 01234', '56789', ' ok'])).toBe('acct ••••6789 ok');
    expect(await scrubbed(['mail ada', '@exam', 'ple.com', ' ok'])).toBe('mail a•••@example.com ok');
  });

  it('leaves amounts, loan ids and dates alone', async () => {
    const text = 'You owe ₦120,000.00 on LN-104, next on 2026-10-25 (JUNE 2026), 12 months, ₦1,250,000.50 total.';
    expect(await scrubbed([text])).toBe(text);
    expect(await scrubbed(['₦120,', '000.00 on LN-', '104'])).toBe('₦120,000.00 on LN-104');
  });

  it('holds back only the tail that could still grow into something to mask', () => {
    expect(splitSafe('Your balance is ')).toEqual(['Your balance is ', '']);
    expect(splitSafe('Your bal')).toEqual(['Your ', 'bal']);
    expect(splitSafe('call 0803 ')).toEqual(['call ', '0803 ']);
  });
});

describe('masks', () => {
  it('shows only what C3 allows', () => {
    expect(maskPhone('+2348031234567')).toBe('+234•••••4567');
    expect(maskPhone('08031234567')).toBe('080•••••4567');
    expect(maskEmail('ada.obi@example.com')).toBe('a•••@example.com');
    expect(maskAccount('0123456789')).toBe('••••6789');
    expect(maskPhone(null)).toBeNull();
    expect(maskSensitive('nothing here')).toBe('nothing here');
  });
});
