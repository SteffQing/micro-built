import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { BypassMaintenance } from 'src/auth/roles.decorator';
import { PayrollVariationService } from 'src/obligations/payroll-variation.service';

// Resend signs webhooks with Svix. The signed payload is the exact bytes of the
// request body, so this route depends on `rawBody: true` in main.ts.
const TOLERANCE_SECONDS = 5 * 60;

type ResendEvent = {
  type?: string;
  data?: { email_id?: string; bounce?: { message?: string } };
};

@ApiExcludeController()
@Controller('webhooks/resend')
export class ResendWebhookController {
  constructor(private readonly variations: PayrollVariationService) {}

  @Post()
  @HttpCode(200)
  @BypassMaintenance()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') id?: string,
    @Headers('svix-timestamp') timestamp?: string,
    @Headers('svix-signature') signature?: string,
  ) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    // Fail closed. An unauthenticated route that mutates submission records
    // must never accept traffic it cannot verify.
    if (!secret)
      throw new ServiceUnavailableException('Webhook secret is not configured');
    const raw = req.rawBody;
    if (!raw?.length) throw new BadRequestException('Missing request body');
    if (!id || !timestamp || !signature)
      throw new UnauthorizedException('Missing signature headers');

    this.verify(secret, id, timestamp, signature, raw);

    let event: ResendEvent;
    try {
      event = JSON.parse(raw.toString('utf8')) as ResendEvent;
    } catch {
      throw new BadRequestException('Body is not valid JSON');
    }

    const messageId = event.data?.email_id;
    const outcome =
      event.type === 'email.delivered'
        ? 'delivered'
        : event.type === 'email.bounced'
          ? 'bounced'
          : event.type === 'email.complained'
            ? 'complained'
            : null;
    // Every other Resend event (sent, opened, clicked, delayed) says nothing
    // about final delivery. Acknowledge so the provider stops retrying.
    if (!outcome || !messageId) return { received: true };

    const batchId = await this.variations.recordDelivery(
      messageId,
      outcome,
      event.data?.bounce?.message,
    );
    return { received: true, batchId };
  }

  private verify(
    secret: string,
    id: string,
    timestamp: string,
    signature: string,
    body: Buffer,
  ) {
    const sentAt = Number(timestamp);
    if (!Number.isFinite(sentAt))
      throw new UnauthorizedException('Invalid signature timestamp');
    if (Math.abs(Date.now() / 1000 - sentAt) > TOLERANCE_SECONDS)
      throw new UnauthorizedException('Signature timestamp is outside tolerance');

    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = createHmac('sha256', key)
      .update(`${id}.${timestamp}.${body.toString('utf8')}`)
      .digest();
    // Svix may send several space-separated versioned signatures during a
    // secret rotation. Any one of them matching is enough.
    const matched = signature.split(' ').some((part) => {
      const [version, value] = part.split(',');
      if (version !== 'v1' || !value) return false;
      const candidate = Buffer.from(value, 'base64');
      return (
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected)
      );
    });
    if (!matched) throw new UnauthorizedException('Invalid webhook signature');
  }
}
