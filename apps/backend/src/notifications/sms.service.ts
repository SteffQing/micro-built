import { Inject, Injectable } from '@nestjs/common';
import { CODE_TTL_MINUTES, TWO_FACTOR_CODE_TTL_MINUTES } from 'src/auth/auth.constants';
import { SMS_PROVIDER, type SmsProvider } from './sms.provider';

export type SmsCodePurpose = 'verify' | 'reset-password' | 'two-factor';

export function codeText(code: string, purpose: SmsCodePurpose): string {
  switch (purpose) {
    case 'verify':
      return `Your MicroBuilt verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. Never share it.`;
    case 'reset-password':
      return `Your MicroBuilt password reset code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. Never share it.`;
    case 'two-factor':
      return `Your MicroBuilt sign-in code is ${code}. It expires in ${TWO_FACTOR_CODE_TTL_MINUTES} minutes. Never share it.`;
  }
}

@Injectable()
export class SmsService {
  constructor(@Inject(SMS_PROVIDER) private readonly provider: SmsProvider) {}

  /** Account and loan notifications. */
  send(to: string, message: string): Promise<void> {
    return this.provider.send({ to, text: message });
  }

  /** A one-time code, on the transactional route so it reaches DND-registered numbers. */
  sendCode(to: string, code: string, purpose: SmsCodePurpose): Promise<void> {
    return this.provider.send({ to, text: codeText(code, purpose), transactional: true });
  }
}
