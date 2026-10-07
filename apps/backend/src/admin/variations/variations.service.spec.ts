import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VARIATION_FILE_URL_TTL, VariationsAdminService } from './variations.service';

const dec = (value: string | number) => new Prisma.Decimal(value);
const NAVY = { id: 'ORG-NAVY', name: 'Navy' };
const NPF = { id: 'ORG-NPF', name: 'NPF' };
const AT = new Date('2026-10-15T09:00:00.000Z');

describe('VariationsAdminService', () => {
  const prisma = { organization: { findMany: jest.fn() } };
  const variations = { preview: jest.fn(), history: jest.fn(), generationCheck: jest.fn(), file: jest.fn() };
  const supabase = { signedUrl: jest.fn() };
  const queue = { queueVariationGenerate: jest.fn(), generateVariationDraft: jest.fn() };
  let service: VariationsAdminService;

  const check = (organization: { id: string; name: string }, over: { skipped?: boolean; blockedBy?: string } = {}) => ({
    organization,
    skipped: over.skipped ?? false,
    blockedBy: over.blockedBy ?? null,
  });

  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  beforeEach(() => {
    jest.resetAllMocks();
    service = new VariationsAdminService(prisma as never, variations as never, supabase as never, queue as never);
  });

  describe('preview', () => {
    it('hands the filter on and answers with numbers, ISO dates and the contract’s month and lock shapes', async () => {
      variations.preview.mockResolvedValue({
        organization: NAVY,
        period: { year: 2026, month: 'OCTOBER', ym: '2026-10', label: 'OCTOBER 2026' },
        variation: {
          id: 'V-1',
          version: 2,
          createdAt: AT,
          updatedAt: AT,
          lock: { kind: 'VOUCHER', voucherId: 'VC-1', filename: 'navy.xlsx', uploadedAt: AT },
          regenerateHint: false,
          versions: [2],
        },
        rows: [
          {
            loanId: 'LN-1',
            customerId: 'MB-1',
            externalId: '123',
            name: 'Ada Obi',
            command: 'LAGOS',
            balance: dec('90000.5'),
            amount: dec('22500'),
            tenure: 4,
            action: 'AMEND',
            reasons: ['TOPUP'],
            start: '01/10/2026',
            end: '31/01/2027',
          },
        ],
        counts: { START: 0, AMEND: 1, STOP: 0 },
        frozen: 3,
        skipped: false,
        generateBlockedBy: "Navy's OCTOBER 2026 variation is locked: its voucher is in",
      });

      const data = await service.preview({
        organizationId: NAVY.id,
        period: '2026-10',
        action: 'AMEND',
        reason: 'TOPUP',
      });

      expect(variations.preview).toHaveBeenCalledWith(NAVY.id, { year: 2026, month: 'OCTOBER' }, { action: 'AMEND', reason: 'TOPUP' });
      expect(data).toEqual({
        organization: NAVY,
        period: { ym: '2026-10', label: 'OCTOBER 2026' },
        variation: {
          id: 'V-1',
          version: 2,
          createdAt: AT.toISOString(),
          updatedAt: AT.toISOString(),
          lock: { kind: 'VOUCHER', voucherId: 'VC-1', filename: 'navy.xlsx', uploadedAt: AT.toISOString() },
          regenerateHint: false,
          versions: [2],
        },
        rows: [expect.objectContaining({ loanId: 'LN-1', balance: 90000.5, amount: 22500, action: 'AMEND' })],
        counts: { START: 0, AMEND: 1, STOP: 0 },
        frozen: 3,
        skipped: false,
        generateBlockedBy: "Navy's OCTOBER 2026 variation is locked: its voucher is in",
      });
    });

    it('answers a month never generated with no variation, and a no payroll lock with its reason', async () => {
      const base = {
        organization: NAVY,
        period: { year: 2026, month: 'OCTOBER', ym: '2026-10', label: 'OCTOBER 2026' },
        rows: [],
        counts: { START: 0, AMEND: 0, STOP: 0 },
        frozen: 0,
        skipped: true,
        generateBlockedBy: null,
      };
      variations.preview.mockResolvedValueOnce({ ...base, variation: null });
      await expect(service.preview({ organizationId: NAVY.id, period: '2026-10' })).resolves.toMatchObject({
        variation: null,
        skipped: true,
      });

      variations.preview.mockResolvedValueOnce({
        ...base,
        variation: {
          id: 'V-1',
          version: 1,
          createdAt: AT,
          updatedAt: AT,
          lock: { kind: 'NO_PAYROLL', reason: 'Payroll sent nothing' },
          regenerateHint: false,
          versions: [1],
        },
      });
      const { variation } = await service.preview({ organizationId: NAVY.id, period: '2026-10' });
      expect(variation?.lock).toEqual({ kind: 'NO_PAYROLL', reason: 'Payroll sent nothing' });
    });
  });

  describe('history', () => {
    it('lists the months newest first with their lock', async () => {
      variations.history.mockResolvedValue([
        {
          id: 'V-2',
          period: { year: 2026, month: 'NOVEMBER', ym: '2026-11', label: 'NOVEMBER 2026' },
          version: 1,
          updatedAt: AT,
          lock: null,
        },
        {
          id: 'V-1',
          period: { year: 2026, month: 'OCTOBER', ym: '2026-10', label: 'OCTOBER 2026' },
          version: 3,
          updatedAt: AT,
          lock: { kind: 'NO_PAYROLL', reason: 'Payroll sent nothing' },
        },
      ]);
      await expect(service.history({ organizationId: NAVY.id })).resolves.toEqual([
        { id: 'V-2', period: { ym: '2026-11', label: 'NOVEMBER 2026' }, version: 1, updatedAt: AT.toISOString(), lock: null },
        {
          id: 'V-1',
          period: { ym: '2026-10', label: 'OCTOBER 2026' },
          version: 3,
          updatedAt: AT.toISOString(),
          lock: { kind: 'NO_PAYROLL', reason: 'Payroll sent nothing' },
        },
      ]);
      expect(variations.history).toHaveBeenCalledWith(NAVY.id);
    });
  });

  describe('generate', () => {
    it('sorts each organization into skipped, refused or queued, and queues one job per queued one', async () => {
      const EMPTY = { id: 'ORG-EMPTY', name: 'Empty' };
      prisma.organization.findMany.mockResolvedValue([EMPTY, NAVY, NPF]);
      variations.generationCheck
        .mockResolvedValueOnce(check(EMPTY, { skipped: true }))
        .mockResolvedValueOnce(check(NAVY))
        .mockResolvedValueOnce(check(NPF, { blockedBy: 'Generate NPF’s SEPTEMBER 2026 variation first' }));

      const data = await service.generate({ period: '2026-10', all: true }, 'AD-1');

      expect(data).toEqual({
        period: { ym: '2026-10', label: 'OCTOBER 2026' },
        queued: [NAVY],
        skipped: [EMPTY],
        refused: [{ ...NPF, reason: 'Generate NPF’s SEPTEMBER 2026 variation first' }],
      });
      expect(queue.queueVariationGenerate).toHaveBeenCalledTimes(1);
      expect(queue.queueVariationGenerate).toHaveBeenCalledWith({
        organizationId: NAVY.id,
        period: '2026-10',
        requestedById: 'AD-1',
      });
      // `all` reads every organization; the check runs for the month asked.
      expect(prisma.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(variations.generationCheck).toHaveBeenCalledWith(EMPTY.id, { year: 2026, month: 'OCTOBER' });
    });

    it('generates for the organizations named, each once', async () => {
      prisma.organization.findMany.mockResolvedValue([NAVY]);
      variations.generationCheck.mockResolvedValue(check(NAVY));
      await service.generate({ period: '2026-10', organizationIds: [NAVY.id, NAVY.id] }, 'AD-1');
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [NAVY.id] } } }),
      );
      expect(queue.queueVariationGenerate).toHaveBeenCalledTimes(1);
    });

    it('queues nothing when an organization named does not exist', async () => {
      prisma.organization.findMany.mockResolvedValue([NAVY]);
      await expect(
        service.generate({ period: '2026-10', organizationIds: [NAVY.id, 'ORG-GONE'] }, 'AD-1'),
      ).rejects.toThrow('Organization not found');
      expect(queue.queueVariationGenerate).not.toHaveBeenCalled();
    });

    it.each([
      [{ period: '2026-10' }, 'Choose the organizations to generate for, or all of them'],
      [{ period: '2026-10', organizationIds: [] }, 'Choose the organizations to generate for, or all of them'],
      [{ period: '2026-10', all: false }, 'Choose the organizations to generate for, or all of them'],
      [{ period: '2026-10', all: true, organizationIds: ['ORG-1'] }, 'Choose some organizations or all of them, not both'],
    ])('refuses %j', async (dto, message) => {
      await expect(service.generate(dto, 'AD-1')).rejects.toThrow(message);
      expect(queue.queueVariationGenerate).not.toHaveBeenCalled();
    });

    it('reports an organization whose job could not be queued as refused, and carries on', async () => {
      prisma.organization.findMany.mockResolvedValue([NAVY, NPF]);
      variations.generationCheck.mockImplementation((id: string) => Promise.resolve(check(id === NAVY.id ? NAVY : NPF)));
      queue.queueVariationGenerate.mockRejectedValueOnce(new Error('redis down')).mockResolvedValueOnce(undefined);
      const data = await service.generate({ period: '2026-10', all: true }, 'AD-1');
      expect(data.queued).toEqual([NPF]);
      expect(data.refused).toEqual([{ ...NAVY, reason: 'It could not be queued. Try again.' }]);
    });
  });

  describe('draft', () => {
    it('queues the draft for the signed-in admin’s email', async () => {
      variations.generationCheck.mockResolvedValue(check(NAVY));
      await expect(
        service.draft({ organizationId: NAVY.id, period: '2026-10' }, 'ada@example.com', 'AD-1'),
      ).resolves.toEqual({ period: 'OCTOBER 2026', organization: 'Navy', email: 'ada@example.com' });
      expect(queue.generateVariationDraft).toHaveBeenCalledWith({
        organizationId: NAVY.id,
        period: '2026-10',
        email: 'ada@example.com',
        requestedById: 'AD-1',
      });
    });

    it('needs an email address to send to', async () => {
      await expect(service.draft({ organizationId: NAVY.id, period: '2026-10' }, null, 'AD-1')).rejects.toThrow(
        'Add an email address to your account to receive drafts',
      );
      expect(queue.generateVariationDraft).not.toHaveBeenCalled();
    });

    it('has nothing to draft for an organization with no deductions, or a month generating is refused for', async () => {
      variations.generationCheck.mockResolvedValueOnce(check(NAVY, { skipped: true }));
      await expect(
        service.draft({ organizationId: NAVY.id, period: '2026-10' }, 'ada@example.com', 'AD-1'),
      ).rejects.toThrow('Navy has no deductions for OCTOBER 2026: there is nothing to draft');
      variations.generationCheck.mockResolvedValueOnce(check(NAVY, { blockedBy: "Navy's OCTOBER 2026 variation is locked: its voucher is in" }));
      await expect(
        service.draft({ organizationId: NAVY.id, period: '2026-10' }, 'ada@example.com', 'AD-1'),
      ).rejects.toThrow('locked');
      expect(queue.generateVariationDraft).not.toHaveBeenCalled();
    });

    it('says so when the draft could not be queued', async () => {
      variations.generationCheck.mockResolvedValue(check(NAVY));
      queue.generateVariationDraft.mockRejectedValue(new Error('redis down'));
      await expect(
        service.draft({ organizationId: NAVY.id, period: '2026-10' }, 'ada@example.com', 'AD-1'),
      ).rejects.toThrow('The draft could not be queued. Try again.');
    });
  });

  describe('fileUrl', () => {
    it('signs the stored version and names the download after it', async () => {
      variations.file.mockResolvedValue({
        path: 'ORG-NAVY/2026-10/v1.xlsx',
        fileName: 'variation-navy-2026-10-v1.xlsx',
        version: 1,
      });
      supabase.signedUrl.mockResolvedValue('https://files.example/signed');
      await expect(service.fileUrl('V-1', { version: 1 })).resolves.toEqual({
        url: 'https://files.example/signed',
        expiresIn: VARIATION_FILE_URL_TTL,
        filename: 'variation-navy-2026-10-v1.xlsx',
      });
      expect(variations.file).toHaveBeenCalledWith('V-1', 1);
      expect(supabase.signedUrl).toHaveBeenCalledWith(
        'variations',
        'ORG-NAVY/2026-10/v1.xlsx',
        VARIATION_FILE_URL_TTL,
        'variation-navy-2026-10-v1.xlsx',
      );
    });
  });
});
