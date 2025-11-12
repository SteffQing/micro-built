import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Public } from './events';
// import { JoinWaitlistDto } from 'src/common/dto/app.dto';
// import { MailService } from 'src/notification/email.service';

@Injectable()
export class EventsService {
  constructor(private email: MailService) {}

  @OnEvent(Public.joinWaitlist)
  async handleWaitlistNotification(payload: JoinWaitlistDto & { id: number }) {
    try {
      await this.email.waitlistMail(payload.email, payload.id, payload.name);
    } catch (error) {
      console.error('Error in handleWaitlistNotification', error);
    }
  }

  @OnEvent(Public.joinNewsletter)
  async handleNewsletterJoining(payload: { email: string }) {
    console.log(payload);
  }
}
