import { createHmac } from 'crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ResendWebhookController } from './resend-webhook.controller';
import type { PayrollVariationService } from 'src/obligations/payroll-variation.service';

const SECRET = `whsec_${Buffer.from('a-test-signing-key').toString('base64')}`;

function sign(id: string, timestamp: string, body: string, secret = SECRET) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')}`;
}
const request = (body: string) =>
  ({ rawBody: Buffer.from(body, 'utf8') }) as RawBodyRequest<Request>;
const now = () => Math.floor(Date.now() / 1000).toString();

describe('ResendWebhookController', () => {
  let recordDelivery: jest.Mock;
  let controller: ResendWebhookController;

  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    recordDelivery = jest.fn().mockResolvedValue('VAR-1');
    controller = new ResendWebhookController({
      recordDelivery,
    } as unknown as PayrollVariationService);
  });
  afterEach(() => delete process.env.RESEND_WEBHOOK_SECRET);

  const call = (payload: object, timestamp = now(), id = 'msg_1') => {
    const body = JSON.stringify(payload);
    return controller.handle(
      request(body),
      id,
      timestamp,
      sign(id, timestamp, body),
    );
  };

  it('records a bounce against the batch that sent the message', async () => {
    await expect(
      call({
        type: 'email.bounced',
        data: { email_id: 'em_1', bounce: { message: 'domain not found' } },
      }),
    ).resolves.toEqual({ received: true, batchId: 'VAR-1' });
    expect(recordDelivery).toHaveBeenCalledWith(
      'em_1',
      'bounced',
      'domain not found',
    );
  });

  it('records a confirmed delivery', async () => {
    await call({ type: 'email.delivered', data: { email_id: 'em_2' } });
    expect(recordDelivery).toHaveBeenCalledWith('em_2', 'delivered', undefined);
  });

  it('ignores events that say nothing about final delivery', async () => {
    await expect(
      call({ type: 'email.opened', data: { email_id: 'em_3' } }),
    ).resolves.toEqual({ received: true });
    expect(recordDelivery).not.toHaveBeenCalled();
  });

  it('rejects a forged signature', async () => {
    const body = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'em_4' },
    });
    const timestamp = now();
    await expect(
      controller.handle(
        request(body),
        'msg_4',
        timestamp,
        sign(
          'msg_4',
          timestamp,
          body,
          `whsec_${Buffer.from('wrong-key').toString('base64')}`,
        ),
      ),
    ).rejects.toThrow('Invalid webhook signature');
    expect(recordDelivery).not.toHaveBeenCalled();
  });

  it('rejects a replayed request outside the timestamp tolerance', async () => {
    const stale = (Math.floor(Date.now() / 1000) - 600).toString();
    await expect(call({ type: 'email.delivered' }, stale)).rejects.toThrow(
      'Signature timestamp is outside tolerance',
    );
  });

  it('rejects a body whose bytes were altered after signing', async () => {
    const timestamp = now();
    const signed = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'em_5' },
    });
    const tampered = JSON.stringify({
      type: 'email.bounced',
      data: { email_id: 'em_5' },
    });
    await expect(
      controller.handle(
        request(tampered),
        'msg_5',
        timestamp,
        sign('msg_5', timestamp, signed),
      ),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('fails closed when no signing secret is configured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    await expect(call({ type: 'email.delivered' })).rejects.toThrow(
      'Webhook secret is not configured',
    );
  });

  it('requires the signature headers', async () => {
    await expect(
      controller.handle(request('{}'), undefined, undefined, undefined),
    ).rejects.toThrow('Missing signature headers');
  });
});
