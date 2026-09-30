import type { SmsMessage, SmsProvider } from './sms.provider';
import { SmsService } from './sms.service';
import { termiiNumber } from './sms.termii.provider';

describe('SmsService', () => {
  const sent: SmsMessage[] = [];
  const provider: SmsProvider = { send: async (message) => void sent.push(message) };
  const sms = new SmsService(provider);

  beforeEach(() => (sent.length = 0));

  it('sends codes on the transactional route and notifications on the normal one', async () => {
    await sms.sendCode('+2348012345678', '123456', 'two-factor');
    await sms.send('+2348012345678', 'Your loan has been disbursed');
    expect(sent[0]).toMatchObject({ to: '+2348012345678', transactional: true });
    expect(sent[0].text).toContain('123456');
    expect(sent[0].text).toContain('5 minutes');
    expect(sent[1].transactional).toBeUndefined();
  });

  it('words each code for what it is for', async () => {
    await sms.sendCode('+2348012345678', '111111', 'verify');
    await sms.sendCode('+2348012345678', '222222', 'reset-password');
    expect(sent[0].text).toMatch(/verification code is 111111/);
    expect(sent[1].text).toMatch(/password reset code is 222222/);
  });
});

describe('termiiNumber', () => {
  it('drops the plus and replaces a leading 0 with 234', () => {
    expect(termiiNumber('+2348012345678')).toBe('2348012345678');
    expect(termiiNumber('08012345678')).toBe('2348012345678');
    expect(termiiNumber('234 801 234 5678')).toBe('2348012345678');
  });
});
