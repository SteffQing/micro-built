import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { VouchersService } from './vouchers.service';

// The producer pulls in the other queues' contracts; the service only calls queueVoucher.
jest.mock('src/queue/bull/queue.producer', () => ({ QueueProducer: class {} }));

const HEADER = ['Staff ID', 'Amount', 'Full Name', 'Period', 'MDA'];

beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));

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
const ORGANIZATION = { id: 'ORG-1', name: 'NPF' };
const GENERATED_JUNE = { id: 'VAR-JUN', version: 2, noPayrollReason: null, voucher: null };
const MAY = { variationId: 'VAR-MAY', ym: '2026-05', label: 'MAY 2026' };

function build() {
  const tx = {
    voucher: { create: jest.fn().mockResolvedValue({ id: 'VC-1' }) },
    $queryRaw: jest.fn().mockResolvedValue([{ noPayrollReason: null }]),
  };
  const prisma = {
    organization: { findUnique: jest.fn().mockResolvedValue(ORGANIZATION) },
    variation: { findFirst: jest.fn().mockResolvedValue(GENERATED_JUNE) },
    voucher: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn() },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    deduction: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const supabase = {
    uploadPrivate: jest.fn().mockResolvedValue('path'),
    removePrivate: jest.fn().mockResolvedValue(undefined),
  };
  const queue = { queueVoucher: jest.fn().mockResolvedValue(undefined) };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn(),
  };
  const locks = {
    earlierUnlocked: jest.fn().mockResolvedValue([]),
    lockedAfter: jest.fn().mockResolvedValue(null),
    revertVoucher: jest.fn(),
  };
  const settings = { requirePenaltyRate: jest.fn().mockResolvedValue(new Prisma.Decimal('0.1')) };
  const clock = { now: () => new Date('2026-06-20T10:00:00Z') };
  const service = new VouchersService(
    prisma as never,
    supabase as never,
    queue as never,
    ledgerTx as never,
    locks as never,
    settings as never,
    clock as never,
  );
  return { service, prisma, supabase, queue, ledgerTx, locks, settings, tx };
}

describe('VouchersService.upload', () => {
  it("stores the sheet, records the voucher in the organization's variation, and queues it", async () => {
    const { service, prisma, supabase, queue, ledgerTx, tx } = build();
    const file = sheetFile(JUNE_ROWS);
    const hash = createHash('sha256').update(file.buffer).digest('hex');

    await expect(service.upload(file, 'ORG-1', 'AD-1')).resolves.toEqual({
      voucherId: 'VC-1',
      variationId: 'VAR-JUN',
      organization: ORGANIZATION,
      period: 'JUNE 2026',
      rows: 2,
    });

    expect(prisma.variation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'ORG-1', version: { gt: 0 }, period: { year: 2026, month: 'JUNE' } },
      }),
    );
    expect(supabase.uploadPrivate).toHaveBeenCalledWith('payroll-uploads', `2026-06/${hash}.xlsx`, file.buffer, file.mimetype);
    expect(tx.voucher.create).toHaveBeenCalledWith({
      data: {
        variationId: 'VAR-JUN',
        fileHash: hash,
        filename: 'june.xlsx',
        uploadedById: 'AD-1',
        createdAt: new Date('2026-06-20T10:00:00Z'),
      },
      select: { id: true },
    });
    // The job writes VOUCHER_UPLOADED once the voucher is processed.
    expect(ledgerTx.audit).not.toHaveBeenCalled();
    expect(queue.queueVoucher).toHaveBeenCalledWith({ voucherId: 'VC-1' });
  });

  it('accepts a requested period that matches the sheet', async () => {
    const { service } = build();
    await expect(service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1', '2026-06')).resolves.toMatchObject({
      period: 'JUNE 2026',
    });
  });

  it('409 until a penalty rate is set, storing nothing: settling charges penalties', async () => {
    const { service, settings, supabase, tx } = build();
    settings.requirePenaltyRate.mockRejectedValue(new ConflictException('Set the penalty rate first'));
    await expect(service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1')).rejects.toThrow('Set the penalty rate first');
    expect(supabase.uploadPrivate).not.toHaveBeenCalled();
    expect(tx.voucher.create).not.toHaveBeenCalled();
  });

  it('404 for an organization that does not exist, storing nothing', async () => {
    const { service, prisma, supabase } = build();
    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(service.upload(sheetFile(JUNE_ROWS), 'NOPE', 'AD-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(supabase.uploadPrivate).not.toHaveBeenCalled();
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
      const result = service.upload(file, 'ORG-1', 'AD-1', period);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(message);
      expect(supabase.uploadPrivate).not.toHaveBeenCalled();
      expect(queue.queueVoucher).not.toHaveBeenCalled();
    });
  });

  describe('refuses with 409, storing nothing', () => {
    it.each([
      ['the organization has no variation for the month', null, "Generate NPF's JUNE 2026 variation first"],
      [
        'the variation already has its voucher',
        { ...GENERATED_JUNE, voucher: { id: 'VC-0' } },
        "NPF's JUNE 2026 variation already has a voucher",
      ],
      [
        'the variation was marked No payroll',
        { ...GENERATED_JUNE, noPayrollReason: 'Never sent' },
        "NPF's JUNE 2026 variation was marked No payroll: revert that before uploading its voucher",
      ],
    ])('%s', async (_name, variation, message) => {
      const { service, prisma, supabase, queue } = build();
      prisma.variation.findFirst.mockResolvedValue(variation);
      const result = service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1');
      await expect(result).rejects.toBeInstanceOf(ConflictException);
      await expect(result).rejects.toThrow(message);
      expect(supabase.uploadPrivate).not.toHaveBeenCalled();
      expect(queue.queueVoucher).not.toHaveBeenCalled();
    });

    it('a later month of the organization is already locked: nothing goes back before it', async () => {
      const { service, locks, supabase } = build();
      locks.lockedAfter.mockResolvedValue({ year: 2026, month: 'JULY' });
      await expect(service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1')).rejects.toThrow(
        "NPF's JULY 2026 variation is already locked, so JUNE 2026 can't take a voucher any more",
      );
      expect(supabase.uploadPrivate).not.toHaveBeenCalled();
    });

    it('the same file was uploaded before (fileHash)', async () => {
      const { service, prisma, supabase } = build();
      prisma.voucher.findUnique.mockResolvedValue({ id: 'VC-0' });
      await expect(service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1')).rejects.toThrow(
        new ConflictException('This file has already been uploaded'),
      );
      expect(supabase.uploadPrivate).not.toHaveBeenCalled();
    });

    it('an earlier month is unlocked: the body names it so No payroll can be offered', async () => {
      const { service, locks, supabase } = build();
      locks.earlierUnlocked.mockResolvedValue([MAY]);

      const refused = await service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1').catch((error: unknown) => error);

      expect(refused).toBeInstanceOf(ConflictException);
      expect((refused as ConflictException).getResponse()).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'NPF has no voucher yet for MAY 2026: upload it, or mark it No payroll, before this one',
        earlierUnlocked: [MAY],
      });
      expect(locks.earlierUnlocked).toHaveBeenCalledWith('ORG-1', { year: 2026, month: 'JUNE' });
      expect(supabase.uploadPrivate).not.toHaveBeenCalled();
    });

    it('every other 409 is a plain message', async () => {
      const { service, prisma } = build();
      prisma.variation.findFirst.mockResolvedValue(null);
      const refused = await service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1').catch((error: unknown) => error);
      const body = (refused as ConflictException).getResponse();
      expect(body).toMatchObject({ statusCode: 409, message: "Generate NPF's JUNE 2026 variation first" });
      expect(body).not.toHaveProperty('earlierUnlocked');
    });
  });

  it('refuses when No payroll got in between the checks and the insert', async () => {
    const { service, tx, queue } = build();
    tx.$queryRaw.mockResolvedValue([{ noPayrollReason: 'Never sent' }]);
    await expect(service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1')).rejects.toThrow(
      "NPF's JUNE 2026 variation was marked No payroll",
    );
    expect(tx.voucher.create).not.toHaveBeenCalled();
    expect(queue.queueVoucher).not.toHaveBeenCalled();
  });

  it('turns a race into a 409: the same file, or another voucher into the same variation', async () => {
    const { service, tx, queue } = build();
    const unique = (target: string[]) =>
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6',
        meta: { target },
      });

    tx.voucher.create.mockRejectedValueOnce(unique(['fileHash']));
    await expect(service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1')).rejects.toThrow(
      new ConflictException('This file has already been uploaded'),
    );
    tx.voucher.create.mockRejectedValueOnce(unique(['variationId']));
    await expect(service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1')).rejects.toThrow(
      new ConflictException("NPF's JUNE 2026 variation already has a voucher"),
    );
    expect(queue.queueVoucher).not.toHaveBeenCalled();
  });

  it('removes the voucher again when it cannot be queued, so the file can be retried', async () => {
    const { service, prisma, queue } = build();
    queue.queueVoucher.mockRejectedValue(new Error('redis down'));
    await expect(service.upload(sheetFile(JUNE_ROWS), 'ORG-1', 'AD-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.voucher.delete).toHaveBeenCalledWith({ where: { id: 'VC-1' } });
  });
});

describe('VouchersService.validate', () => {
  it('reports a clean sheet as ready, with the variation it lands in', async () => {
    const { service } = build();
    await expect(service.validate(sheetFile(JUNE_ROWS), 'ORG-1')).resolves.toEqual({
      valid: true,
      period: 'JUNE 2026',
      rows: 2,
      missingColumns: [],
      problems: [],
      invalidRows: [],
      organization: ORGANIZATION,
      variation: { id: 'VAR-JUN', version: 2 },
      issues: { unmatched: 2, otherOrganization: 0, notInVariation: 0 },
      earlierUnlocked: [],
      conflicts: [],
    });
  });

  it('counts the rows that would be left as issues, by why', async () => {
    const { service, prisma } = build();
    prisma.customer.findMany.mockResolvedValue([
      { userId: 'MB-1', externalId: '111', payroll: { organizationId: 'ORG-1' } },
      { userId: 'MB-2', externalId: '222', payroll: { organizationId: 'ORG-2' } },
      { userId: 'MB-3', externalId: '333', payroll: { organizationId: 'ORG-1' } },
    ]);
    // Only MB-1 has a deduction waiting in the variation.
    prisma.deduction.findMany.mockResolvedValue([{ loan: { borrowerId: 'MB-1' } }]);
    const rows = [
      ...JUNE_ROWS,
      ['333', 30000, 'Cy', 'JUNE 2026', 'NAVY'],
      ['999', 10000, 'Di', 'JUNE 2026', 'NAVY'],
      ['444', 0, 'Ed', 'JUNE 2026', 'NAVY'],
    ];

    const report = await service.validate(sheetFile(rows), 'ORG-1');

    expect(report.issues).toEqual({ unmatched: 1, otherOrganization: 1, notInVariation: 1 });
    expect(prisma.deduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { variationId: 'VAR-JUN', status: { in: ['AWAITING', 'PARTIAL'] }, loan: { status: 'DISBURSED' } },
      }),
    );
  });

  it('reports every problem, sheet and month alike, and stores nothing', async () => {
    const { service, prisma, locks, supabase, queue, ledgerTx } = build();
    prisma.variation.findFirst.mockResolvedValue({ ...GENERATED_JUNE, voucher: { id: 'VC-0' } });
    prisma.voucher.findUnique.mockResolvedValue({ id: 'VC-0' });
    locks.earlierUnlocked.mockResolvedValue([MAY]);

    const report = await service.validate(sheetFile([...JUNE_ROWS, ['111', -1, 'Ada Obi', 'JUNE 2026', 'NAVY']]), 'ORG-1');

    expect(report.valid).toBe(false);
    expect(report.problems).toEqual([
      'Fix these 2 rows: row 2: duplicate staffid; row 4: amount must be a number of naira, 0 or more, duplicate staffid',
      "NPF's JUNE 2026 variation already has a voucher",
      'This file has already been uploaded',
      'NPF has no voucher yet for MAY 2026: upload it, or mark it No payroll, before this one',
    ]);
    expect(report.conflicts).toEqual(report.problems.slice(1));
    expect(report.earlierUnlocked).toEqual([MAY]);
    expect(report.invalidRows.map((row) => row.row)).toEqual([2, 4]);
    // Nothing to pay into once it is locked, so no issues are counted.
    expect(report.issues).toEqual({ unmatched: 0, otherOrganization: 0, notInVariation: 0 });
    expect(supabase.uploadPrivate).not.toHaveBeenCalled();
    expect(ledgerTx.transaction).not.toHaveBeenCalled();
    expect(queue.queueVoucher).not.toHaveBeenCalled();
  });

  it('says there is no variation to land in', async () => {
    const { service, prisma } = build();
    prisma.variation.findFirst.mockResolvedValue(null);
    const report = await service.validate(sheetFile(JUNE_ROWS), 'ORG-1');
    expect(report).toMatchObject({ valid: false, variation: null, conflicts: ["Generate NPF's JUNE 2026 variation first"] });
  });

  it('reports missing columns without a month', async () => {
    const { service, prisma } = build();
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Staff ID'], ['1']]), 'S');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const report = await service.validate({ buffer } as Express.Multer.File, 'ORG-1');

    expect(report).toMatchObject({ valid: false, period: null, rows: 1, variation: null });
    expect(report.missingColumns).toContain('amount');
    expect(prisma.variation.findFirst).not.toHaveBeenCalled();
  });
});

describe('VouchersService.revert', () => {
  it('has the ledger undo the voucher, then removes its stored sheet', async () => {
    const { service, locks, supabase } = build();
    locks.revertVoucher.mockResolvedValue({
      variationId: 'VAR-JUN',
      label: 'NPF · JUNE 2026',
      inflowsRemoved: 5,
      penaltiesRemoved: 2,
      proposalsWithdrawn: 1,
      stored: { period: { year: 2026, month: 'JUNE' }, fileHash: 'abc' },
    });

    await expect(service.revert('VC-1', 'Wrong file', 'AD-1')).resolves.toEqual({
      variationId: 'VAR-JUN',
      inflowsRemoved: 5,
      penaltiesRemoved: 2,
      proposalsWithdrawn: 1,
    });
    expect(locks.revertVoucher).toHaveBeenCalledWith('VC-1', 'Wrong file', 'AD-1');
    expect(supabase.removePrivate).toHaveBeenCalledWith('payroll-uploads', '2026-06/abc.xlsx');
  });

  it('still succeeds when the stored sheet cannot be removed: the money is already right', async () => {
    const { service, locks, supabase } = build();
    locks.revertVoucher.mockResolvedValue({
      variationId: 'VAR-JUN',
      label: 'NPF · JUNE 2026',
      inflowsRemoved: 0,
      penaltiesRemoved: 0,
      proposalsWithdrawn: 0,
      stored: { period: { year: 2026, month: 'JUNE' }, fileHash: 'abc' },
    });
    supabase.removePrivate.mockRejectedValue(new Error('storage down'));
    await expect(service.revert('VC-1', 'Wrong file', 'AD-1')).resolves.toMatchObject({ variationId: 'VAR-JUN' });
  });

  it('does not touch storage when the ledger refuses', async () => {
    const { service, locks, supabase } = build();
    locks.revertVoucher.mockRejectedValue(new ConflictException('JUNE 2026 is over'));
    await expect(service.revert('VC-1', 'Wrong file', 'AD-1')).rejects.toBeInstanceOf(ConflictException);
    expect(supabase.removePrivate).not.toHaveBeenCalled();
  });
});
