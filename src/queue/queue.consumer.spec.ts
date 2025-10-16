import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import { GenerateReports } from './queue.consumer';
import {
  ConsumerReport,
  GenerateMonthlyLoanSchedule,
} from 'src/common/types/report.interface';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from 'src/config/config.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { MailService } from 'src/notifications/mail.service';
import generateLoanReportPDF from 'src/notifications/templates/PDF';
import { writeFileSync } from 'fs';

describe('GenerateReports', () => {
  let consumer: GenerateReports;
  let mailService: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, ConfigModule, NotificationModule],
      providers: [GenerateReports],
    })
      .overrideProvider(MailService)
      .useValue({
        sendLoanScheduleReport: jest.fn().mockResolvedValue(undefined),
        sendCustomerLoanReport: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    consumer = module.get<GenerateReports>(GenerateReports);
    mailService = module.get<MailService>(MailService);
  });

  // it('should process a schedule variation job', async () => {
  //   const job: Partial<Job<GenerateMonthlyLoanSchedule>> = {
  //     data: {
  //       period: 'SEPTEMBER 2025',
  //       email: 'steveola23@gmail.com',
  //     },
  //     progress: jest.fn(),
  //   };

  //   await consumer.generateScheduleVariation(
  //     job as Job<GenerateMonthlyLoanSchedule>,
  //   );

  //   expect(mailService.sendLoanScheduleReport).toHaveBeenCalledWith(
  //     'steveola23@gmail.com',
  //     expect.objectContaining({
  //       period: 'SEPTEMBER 2025',
  //     }),
  //     expect.any(Buffer), // the Excel file
  //   );
  // }, 20000);

  it('should process a user loan report job', async () => {
    const job: Partial<Job<ConsumerReport>> = {
      data: {
        userId: 'MB-9WOEQ',
        email: 'steveola23@gmail.com',
      },
      progress: jest.fn(),
    };

    const pdf = await consumer.generateCustomerLoanReport(
      job as Job<ConsumerReport>,
    );

    writeFileSync('loan-report.pdf', pdf);

    // expect(mailService.sendLoanScheduleReport).toHaveBeenCalledWith(
    //   'steveola23@gmail.com',
    //   expect.objectContaining({
    //     period: 'SEPTEMBER 2025',
    //   }),
    //   expect.any(Buffer), // the Excel file
    // );
  }, 20000);
});
