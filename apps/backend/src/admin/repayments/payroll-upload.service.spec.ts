import { BadRequestException, ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { PayrollUploadService } from './payroll-upload.service';

// The producer pulls in the other queues' contracts; the service only calls queuePayrollUpload.
jest.mock('src/queue/bull/queue.producer', () => ({ QueueProducer: class {} }));

const HEADER = ['Staff ID', 'Amount', 'Full Name', 'Period', 'MDA'];

beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

function sheetFile(rows: unknown[][]): Express.Multer.File {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ...rows]), 'Payroll');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return {
    buffer,
    originalname: 'june.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as Express.Multer.File;
}

const JUNE_ROWS = [
  ['111', 50000, 'Ada Obi', 'JUNE 2026', 'NAVY'],
  ['222', 40000, 'Ben Eze', 'JUNE 2026', 'ARMY'],
];
const OPEN_JUNE = { id: 'P-JUN', variationSubmittedAt: new Date('2026-05-25'), closedAt: null };

function build() {
  const tx = { payrollUpload: { create: jest.fn().mockResolvedValue({ id: 'UP-1' }) } };
  const prisma = {
    payrollPeriod: { findUnique: jest.fn().mockResolvedValue(OPEN_JUNE) },
    payrollUpload: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn() },
    auditLog: { deleteMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const supabase = { uploadPrivate: jest.fn().mockResolvedValue('path') };
  const queue = { queuePayrollUpload: jest.fn().mockResolvedValue(undefined) };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PayrollUploadService(prisma as never, supabase as never, queue as never, ledgerTx as never);
  return { service, prisma, supabase, queue, ledgerTx, tx };
}

describe('PayrollUploadService.upload', () => {
  it('stores the sheet, records the upload with an audit entry, and queues it', async () => {
    const { service, prisma, supabase, queue, ledgerTx, tx } = build();
    const file = sheetFile(JUNE_ROWS);
    const hash = createHash('sha256').update(file.buffer).digest('hex');

    await expect(service.upload(file, 'AD-1')).resolves.toEqual({ uploadId: 'UP-1', period: 'JUNE 2026', rows: 2 });

    expect(prisma.payrollPeriod.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { year_month: { year: 2026, month: 'JUNE' } } }),
    );
    expect(supabase.uploadPrivate).toHaveBeenCalledWith(
      'payroll-uploads',
      `2026-06/${hash}.xlsx`,
      file.buffer,
      file.mimetype,
    );
    expect(tx.payrollUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { periodId: 'P-JUN', fileHash: hash, filename: 'june.xlsx', uploadedById: 'AD-1' },
      }),
    );
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: 'AD-1',
        action: 'PAYROLL_UPLOADED',
        entityType: 'PAYROLL_UPLOAD',
        entityId: 'UP-1',
      }),
    );
    expect(queue.queuePayrollUpload).toHaveBeenCalledWith({ uploadId: 'UP-1' });
  });

  it('accepts a requested period that matches the sheet', async () => {
    const { service } = build();
    await expect(service.upload(sheetFile(JUNE_ROWS), 'AD-1', '2026-06')).resolves.toMatchObject({
      period: 'JUNE 2026',
    });
  });

  describe('refuses with 400, storing nothing', () => {
    const cases: [string, Express.Multer.File, string | undefined, string][] = [
      [
        'a file that is not Excel',
        { buffer: Buffer.from('a,b\n1,2'), originalname: 'x.csv', mimetype: 'text/csv' } as Express.Multer.File,
        undefined,
        'Upload the payroll as an Excel file (.xlsx or .xls)',
      ],
      [
        'rows for different months, listing them',
        sheetFile([...JUNE_ROWS, ['333', 100, 'C', 'JULY 2026', 'NAVY']]),
        undefined,
        'Every row must be for the same month. These rows are not for JUNE 2026: 4',
      ],
      ['a sheet for another month than requested', sheetFile(JUNE_ROWS), '2026-07', 'This sheet is for JUNE 2026, not JULY 2026'],
      [
        'bad rows',
        sheetFile([['', 100, 'C', 'JUNE 2026', 'NAVY']]),
        undefined,
        'Fix this row: row 2: staffid (IPPIS number) is empty',
      ],
    ];

    it.each(cases)('%s', async (_name, file, period, message) => {
      const { service, supabase, queue } = build();
      const result = service.upload(file, 'AD-1', period);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(message);
      expect(supabase.uploadPrivate).not.toHaveBeenCalled();
      expect(queue.queuePayrollUpload).not.toHaveBeenCalled();
    });
  });

  describe('refuses with 409, storing nothing', () => {
    it.each([
      ['the month has no period row yet', null, 'Submit the JUNE 2026 variation before uploading its payroll'],
      [
        "the month's variation is not submitted",
        { ...OPEN_JUNE, variationSubmittedAt: null },
        'Submit the JUNE 2026 variation before uploading its payroll',
      ],
      [
        'the month is closed',
        { ...OPEN_JUNE, closedAt: new Date('2026-07-05') },
        'JUNE 2026 is closed, so its payroll can no longer be uploaded',
      ],
    ])('%s', async (_name, period, message) => {
      const { service, prisma, supabase } = build();
      prisma.payrollPeriod.findUnique.mockResolvedValue(period);
      const result = service.upload(sheetFile(JUNE_ROWS), 'AD-1');
      await expect(result).rejects.toBeInstanceOf(ConflictException);
      await expect(result).rejects.toThrow(message);
      expect(supabase.uploadPrivate).not.toHaveBeenCalled();
    });

    it('the same file was uploaded before (fileHash)', async () => {
      const { service, prisma, supabase } = build();
      prisma.payrollUpload.findUnique.mockResolvedValue({ id: 'UP-0' });
      await expect(service.upload(sheetFile(JUNE_ROWS), 'AD-1')).rejects.toThrow(
        new ConflictException('This file has already been uploaded'),
      );
      expect(supabase.uploadPrivate).not.toHaveBeenCalled();
    });
  });

  it('turns a race on the same file (P2002 on fileHash) into the same 409', async () => {
    const { service, tx, queue } = build();
    tx.payrollUpload.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6' }),
    );
    await expect(service.upload(sheetFile(JUNE_ROWS), 'AD-1')).rejects.toThrow(
      new ConflictException('This file has already been uploaded'),
    );
    expect(queue.queuePayrollUpload).not.toHaveBeenCalled();
  });

  it('removes the upload again when it cannot be queued, so the file can be retried', async () => {
    const { service, prisma, queue } = build();
    queue.queuePayrollUpload.mockRejectedValue(new Error('redis down'));
    await expect(service.upload(sheetFile(JUNE_ROWS), 'AD-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { entityType: 'PAYROLL_UPLOAD', entityId: 'UP-1' },
    });
    expect(prisma.payrollUpload.delete).toHaveBeenCalledWith({ where: { id: 'UP-1' } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('PayrollUploadService.validate', () => {
  it('reports a clean sheet as ready', async () => {
    const { service } = build();
    await expect(service.validate(sheetFile(JUNE_ROWS))).resolves.toEqual({
      valid: true,
      period: 'JUNE 2026',
      rows: 2,
      missingColumns: [],
      problems: [],
      invalidRows: [],
    });
  });

  it('reports every problem, sheet and month alike, and stores nothing', async () => {
    const { service, prisma, supabase, queue, ledgerTx } = build();
    prisma.payrollPeriod.findUnique.mockResolvedValue({ ...OPEN_JUNE, variationSubmittedAt: null });
    prisma.payrollUpload.findUnique.mockResolvedValue({ id: 'UP-0' });

    const report = await service.validate(sheetFile([...JUNE_ROWS, ['111', -1, 'Ada Obi', 'JUNE 2026', 'NAVY']]));

    expect(report.valid).toBe(false);
    expect(report.problems).toEqual([
      'Fix these 2 rows: row 2: duplicate staffid; row 4: amount must be a number of naira, 0 or more, duplicate staffid',
      'Submit the JUNE 2026 variation before uploading its payroll',
      'This file has already been uploaded',
    ]);
    expect(report.invalidRows.map((row) => row.row)).toEqual([2, 4]);
    expect(supabase.uploadPrivate).not.toHaveBeenCalled();
    expect(ledgerTx.transaction).not.toHaveBeenCalled();
    expect(queue.queuePayrollUpload).not.toHaveBeenCalled();
  });

  it('reports missing columns without a month', async () => {
    const { service, prisma } = build();
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Staff ID'], ['1']]), 'S');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const report = await service.validate({ buffer } as Express.Multer.File);

    expect(report).toMatchObject({ valid: false, period: null, rows: 1 });
    expect(report.missingColumns).toContain('amount');
    expect(prisma.payrollPeriod.findUnique).not.toHaveBeenCalled();
  });
});
