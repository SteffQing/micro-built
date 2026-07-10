import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as XLSX from 'xlsx';
import { RepaymentsService } from './repayments.service';
import { PrismaService } from 'src/database/prisma.service';
import { ConfigService } from 'src/config/config.service';
import { SupabaseService } from 'src/database/supabase.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import { MailService } from 'src/notifications/mail.service';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const makeBuffer = (aoa: any[][]): Buffer => {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

const makeFile = (aoa: any[][]): Express.Multer.File =>
  ({
    buffer: makeBuffer(aoa),
    originalname: 'repayments.xlsx',
  }) as Express.Multer.File;

describe('RepaymentsService', () => {
  let service: RepaymentsService;
  let prisma: { repaymentUpload: { findUnique: jest.Mock; create: jest.Mock } };
  let config: { getValue: jest.Mock };
  let supabase: { uploadRepaymentsDoc: jest.Mock };
  let queue: { queueRepayments: jest.Mock; closeRepaymentPeriod: jest.Mock };

  beforeEach(async () => {
    prisma = {
      repaymentUpload: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'upload_1' }),
      },
    };
    config = {
      getValue: jest.fn().mockResolvedValue(null),
    };
    supabase = { uploadRepaymentsDoc: jest.fn() };
    queue = {
      queueRepayments: jest.fn(),
      closeRepaymentPeriod: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: SupabaseService, useValue: supabase },
        { provide: QueueProducer, useValue: queue },
        { provide: MailService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: CustomerNotifierService,
          useValue: { notify: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<RepaymentsService>(RepaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadRepaymentDocument', () => {
    it('throws BadRequestException before Supabase upload when all headers are wrong', async () => {
      const file = makeFile([
        ['IPPIS', 'PAY', 'GROSS', 'NET', 'DEPARTMENT'],
        ['EMP001', 50000, 400000, 80000],
      ]);

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026', 'admin_1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026', 'admin_1'),
      ).rejects.toThrow(
        'Missing required columns: staffid, amount, fullname, period, organization (one of: mda, organization, company, sub organization)',
      );

      expect(supabase.uploadRepaymentsDoc).not.toHaveBeenCalled();
      expect(queue.queueRepayments).not.toHaveBeenCalled();
    });

    it('throws and lists organization when none of its aliases exist', async () => {
      const file = makeFile([
        ['StaffID', 'Amount', 'Full Name', 'Period'],
        ['EMP001', 50000, 400000, 80000],
      ]);

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026', 'admin_1'),
      ).rejects.toThrow(
        'Missing required columns: organization (one of: mda, organization, company, sub organization)',
      );

      expect(supabase.uploadRepaymentsDoc).not.toHaveBeenCalled();
    });

    it('proceeds to upload when all required headers are present and organization comes from an alias', async () => {
      const file = makeFile([
        ['Staff ID', 'AMOUNT', 'Full Name', 'Period', 'Sub Organization'],
        ['EMP001', 71666, 'Jane Doe', 'APRIL 2026', 'FEDERAL'],
      ]);

      supabase.uploadRepaymentsDoc.mockResolvedValue({
        data: 'https://storage/file.xlsx',
        error: null,
      });
      queue.queueRepayments.mockResolvedValue({
        data: null,
        message: 'queued',
      });

      await service.uploadRepaymentDocument(file, 'APRIL 2026', 'admin_1');

      expect(supabase.uploadRepaymentsDoc).toHaveBeenCalledWith(
        file,
        'APRIL 2026',
      );
      expect(queue.queueRepayments).toHaveBeenCalledWith(
        'https://storage/file.xlsx',
        'APRIL 2026',
      );
      expect(prisma.repaymentUpload.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          period: 'APRIL 2026',
          filename: 'repayments.xlsx',
          uploadedBy: 'admin_1',
          rowCount: 1,
        }),
      });
    });

    it('rejects an exact re-upload using the file hash gate', async () => {
      const file = makeFile([
        ['Staff ID', 'AMOUNT', 'Full Name', 'Period', 'MDA'],
        ['EMP001', 71666, 'Jane Doe', 'APRIL 2026', 'FEDERAL'],
      ]);
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');
      prisma.repaymentUpload.findUnique.mockResolvedValue({
        id: 'upload_1',
        fileHash,
      });

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026', 'admin_1'),
      ).rejects.toThrow('This exact file has already been uploaded');

      expect(supabase.uploadRepaymentsDoc).not.toHaveBeenCalled();
      expect(queue.queueRepayments).not.toHaveBeenCalled();
    });

    it('rejects uploads for closed or earlier periods', async () => {
      config.getValue.mockResolvedValue(new Date('2026-04-28T00:00:00.000Z'));
      const file = makeFile([
        ['Staff ID', 'AMOUNT', 'Full Name', 'Period', 'Organization'],
        ['EMP001', 71666, 'Jane Doe', 'APRIL 2026', 'FEDERAL'],
      ]);

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026', 'admin_1'),
      ).rejects.toThrow('The APRIL 2026 period is closed');

      expect(prisma.repaymentUpload.findUnique).not.toHaveBeenCalled();
    });

    it('allows another upload in the same open period when the period has not been closed', async () => {
      config.getValue.mockResolvedValue(new Date('2026-03-01T00:00:00.000Z'));
      const file = makeFile([
        ['Staff ID', 'AMOUNT', 'Full Name', 'Period', 'Company'],
        ['EMP001', 71666, 'Jane Doe', 'APRIL 2026', 'FEDERAL'],
      ]);

      supabase.uploadRepaymentsDoc.mockResolvedValue({
        data: 'https://storage/file.xlsx',
        error: null,
      });
      queue.queueRepayments.mockResolvedValue({
        data: null,
        message: 'queued',
      });

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026', 'admin_1'),
      ).resolves.toEqual({
        data: null,
        message: 'queued',
      });
    });
  });

  describe('closeRepaymentPeriod', () => {
    it('queues an explicit period close for admins', async () => {
      queue.closeRepaymentPeriod.mockResolvedValue({
        data: null,
        message: 'Repayment period close has been queued',
      });

      await expect(service.closeRepaymentPeriod('APRIL 2026')).resolves.toEqual(
        {
          data: null,
          message: 'Repayment period close has been queued',
        },
      );

      expect(queue.closeRepaymentPeriod).toHaveBeenCalledWith('APRIL 2026');
    });
  });

  describe('validateDocument', () => {
    it('returns header failure with missing columns and null rows when headers are wrong', async () => {
      const file = makeFile([
        ['IPPIS', 'PAY'],
        ['EMP001', 50000],
      ]);

      const result = await service.validateDocument(file);

      expect(result.headers.valid).toBe(false);
      expect(result.headers.missing).toEqual([
        'staffid',
        'amount',
        'fullname',
        'period',
        'organization (one of: mda, organization, company, sub organization)',
      ]);
      expect(result.rows).toBeNull();
    });

    it('returns full row report when headers are valid', async () => {
      const file = makeFile([
        ['StaffID', 'Amount', 'Full Name', 'Period', 'Organization'],
        ['EMP001', 71666, 'Jane Doe', 'APRIL 2026', 'FEDERAL'], // valid
        ['', -1, 'bad', 'APRIL 2026', ''], // invalid
      ]);

      const result = await service.validateDocument(file);

      expect(result.headers.valid).toBe(true);
      expect(result.rows).not.toBeNull();
      expect(result.rows!.totalRows).toBe(2);
      expect(result.rows!.valid).toBe(false);
      expect(result.rows!.invalidRows[0].row).toBe(2);
    });

    it('returns valid headers and valid rows for a clean document', async () => {
      const file = makeFile([
        ['StaffID', 'Amount', 'Full Name', 'Period', 'Company'],
        ['EMP001', 71666, 'Jane Doe', 'APRIL 2026', 'FEDERAL'],
        ['EMP002', 66153, 'John Doe', 'APRIL 2026', 'POLICE'],
      ]);

      const result = await service.validateDocument(file);

      expect(result.headers.valid).toBe(true);
      expect(result.rows!.valid).toBe(true);
      expect(result.rows!.totalRows).toBe(2);
      expect(result.rows!.invalidRows).toHaveLength(0);
    });
  });
});
