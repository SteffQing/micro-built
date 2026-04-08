import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { RepaymentsService } from './repayments.service';
import { PrismaService } from 'src/database/prisma.service';
import { ConfigService } from 'src/config/config.service';
import { SupabaseService } from 'src/database/supabase.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import { MailService } from 'src/notifications/mail.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const makeBuffer = (aoa: any[][]): Buffer => {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

const makeFile = (aoa: any[][]): Express.Multer.File =>
  ({ buffer: makeBuffer(aoa) }) as Express.Multer.File;

describe('RepaymentsService', () => {
  let service: RepaymentsService;
  let supabase: { uploadRepaymentsDoc: jest.Mock };
  let queue: { queueRepayments: jest.Mock };

  beforeEach(async () => {
    supabase = { uploadRepaymentsDoc: jest.fn() };
    queue = { queueRepayments: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepaymentsService,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: SupabaseService, useValue: supabase },
        { provide: QueueProducer, useValue: queue },
        { provide: MailService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
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
        ['IPPIS', 'PAY', 'GROSS', 'NET'],
        ['EMP001', 50000, 400000, 80000],
      ]);

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026'),
      ).rejects.toThrow('Missing required columns: staffid, amount, employeegross, netpay');

      expect(supabase.uploadRepaymentsDoc).not.toHaveBeenCalled();
      expect(queue.queueRepayments).not.toHaveBeenCalled();
    });

    it('throws and lists only the missing subset when some headers match', async () => {
      const file = makeFile([
        ['StaffID', 'Amount', 'WRONG', 'COLUMNS'],
        ['EMP001', 50000, 400000, 80000],
      ]);

      await expect(
        service.uploadRepaymentDocument(file, 'APRIL 2026'),
      ).rejects.toThrow('Missing required columns: employeegross, netpay');

      expect(supabase.uploadRepaymentsDoc).not.toHaveBeenCalled();
    });

    it('proceeds to upload when all required headers are present (case/space insensitive)', async () => {
      const file = makeFile([
        ['Staff ID', 'AMOUNT', 'Employee Gross', 'Net Pay'],
        ['EMP001', 71666, 400000, 80000],
      ]);

      supabase.uploadRepaymentsDoc.mockResolvedValue({
        data: 'https://storage/file.xlsx',
        error: null,
      });
      queue.queueRepayments.mockResolvedValue({
        data: null,
        message: 'queued',
      });

      await service.uploadRepaymentDocument(file, 'APRIL 2026');

      expect(supabase.uploadRepaymentsDoc).toHaveBeenCalledWith(
        file,
        'APRIL 2026',
      );
      expect(queue.queueRepayments).toHaveBeenCalledWith(
        'https://storage/file.xlsx',
        'APRIL 2026',
      );
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
        'employeegross',
        'netpay',
      ]);
      expect(result.rows).toBeNull();
    });

    it('returns full row report when headers are valid', async () => {
      const file = makeFile([
        ['StaffID', 'Amount', 'EmployeeGross', 'NetPay'],
        ['EMP001', 71666, 400000, 80000],  // valid
        ['', -1, 'bad', 80000],             // invalid
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
        ['StaffID', 'Amount', 'EmployeeGross', 'NetPay'],
        ['EMP001', 71666, 400000, 80000],
        ['EMP002', 66153, 350000, 70000],
      ]);

      const result = await service.validateDocument(file);

      expect(result.headers.valid).toBe(true);
      expect(result.rows!.valid).toBe(true);
      expect(result.rows!.totalRows).toBe(2);
      expect(result.rows!.invalidRows).toHaveLength(0);
    });
  });
});
