import type { Tx } from 'src/ledger/ledger.tx';
import {
  findOrCreateOrganization,
  mergeBlocker,
  normalizeOrganizationName,
  organizationName,
  organizationPayrollStates,
  type MergeVariation,
} from './organizations';

const NOW = { year: 2026, month: 'NOVEMBER' } as const;
const at = (iso: string) => new Date(iso);

describe('organization names', () => {
  it('keeps the spelling given, trimmed and single-spaced, and matches on it in lower case', () => {
    expect(organizationName('  Nigerian   Navy ')).toBe('Nigerian Navy');
    expect(normalizeOrganizationName('  Nigerian   Navy ')).toBe('nigerian navy');
    expect(normalizeOrganizationName('NIGERIAN NAVY')).toBe(normalizeOrganizationName('nigerian navy'));
  });

  it('finds or creates in one INSERT … ON CONFLICT, so two creators never fail', async () => {
    const db = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'ORG-1', name: 'Nigerian Navy' }) },
    };
    const found = await findOrCreateOrganization(db as unknown as Tx, ' Nigerian  Navy');
    expect(found).toEqual({ id: 'ORG-1', name: 'Nigerian Navy' });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.organization.findUniqueOrThrow).toHaveBeenCalledWith({ where: { normalizedName: 'nigerian navy' } });
  });

  it('refuses a name with nothing in it', async () => {
    await expect(findOrCreateOrganization({} as Tx, '   ')).rejects.toThrow('An organization needs a name');
  });
});

describe('organizationPayrollStates', () => {
  function variation(over: {
    id: string;
    organizationId: string;
    month: string;
    year?: number;
    version?: number;
    updatedAt?: Date;
    noPayrollReason?: string | null;
    voucher?: Date | null;
  }) {
    return {
      id: over.id,
      organizationId: over.organizationId,
      version: over.version ?? 1,
      updatedAt: over.updatedAt ?? at('2026-09-20T10:00:00Z'),
      noPayrollReason: over.noPayrollReason ?? null,
      voucher: over.voucher ? { id: `VOUCHER-${over.id}`, createdAt: over.voucher } : null,
      period: { year: over.year ?? 2026, month: over.month },
    };
  }

  function setup(
    variations: ReturnType<typeof variation>[],
    events: { entityId: string; createdAt: Date }[] = [],
    open: { organizationId: string; year: number; month: string }[] = [],
  ) {
    const db = {
      organization: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ORG-NAVY', name: 'Navy' },
          { id: 'ORG-POLICE', name: 'Police' },
        ]),
      },
      variation: { findMany: jest.fn().mockResolvedValue(variations) },
      auditLog: { findMany: jest.fn().mockResolvedValue(events) },
      $queryRaw: jest.fn().mockResolvedValue(open),
    };
    return db;
  }

  it('gives each organization its latest locked month, the ended months with no voucher and the next to generate', async () => {
    const db = setup(
      [
        variation({ id: 'V-AUG', organizationId: 'ORG-NAVY', month: 'AUGUST', voucher: at('2026-09-05T10:00:00Z') }),
        variation({ id: 'V-SEP', organizationId: 'ORG-NAVY', month: 'SEPTEMBER' }),
        variation({ id: 'V-OCT', organizationId: 'ORG-NAVY', month: 'OCTOBER' }),
        variation({ id: 'V-NOV', organizationId: 'ORG-NAVY', month: 'NOVEMBER' }),
        variation({ id: 'V-POL', organizationId: 'ORG-POLICE', month: 'OCTOBER', noPayrollReason: 'No file' }),
      ],
      [],
      [{ organizationId: 'ORG-NAVY', year: 2026, month: 'DECEMBER' }],
    );
    const states = await organizationPayrollStates(db as unknown as Tx, NOW);

    expect(states.map((s) => s.name)).toEqual(['Navy', 'Police']);
    const [navy, police] = states;
    expect(navy.latestLocked).toEqual({ ym: '2026-08', label: 'AUGUST 2026' });
    expect(navy.unlocked.map((u) => [u.ym, u.version])).toEqual([
      ['2026-09', 1],
      ['2026-10', 1],
      ['2026-11', 1],
    ]);
    // November is still running: no voucher is due for it yet.
    expect(navy.awaitingVoucher).toEqual([
      { ym: '2026-09', label: 'SEPTEMBER 2026' },
      { ym: '2026-10', label: 'OCTOBER 2026' },
    ]);
    expect(navy.toGenerate).toEqual({ ym: '2026-12', label: 'DECEMBER 2026' });

    // A no payroll locks as a voucher does.
    expect(police.latestLocked).toEqual({ ym: '2026-10', label: 'OCTOBER 2026' });
    expect(police.unlocked).toEqual([]);
    expect(police.awaitingVoucher).toEqual([]);
    expect(police.toGenerate).toBeNull();
  });

  it('can be scoped to some organizations', async () => {
    const db = setup([]);
    await organizationPayrollStates(db as unknown as Tx, NOW, ['ORG-NAVY']);
    expect(db.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['ORG-NAVY'] } } }),
    );
  });

  it('answers nothing, and asks nothing more, when there are no organizations', async () => {
    const db = setup([]);
    db.organization.findMany.mockResolvedValue([]);
    await expect(organizationPayrollStates(db as unknown as Tx, NOW)).resolves.toEqual([]);
    expect(db.variation.findMany).not.toHaveBeenCalled();
  });

  describe('regenerate hint (PLAN_V2 R3)', () => {
    it('is set when the previous month locked after this one was last generated', async () => {
      const db = setup([
        variation({
          id: 'V-SEP',
          organizationId: 'ORG-NAVY',
          month: 'SEPTEMBER',
          voucher: at('2026-10-02T10:00:00Z'),
        }),
        variation({ id: 'V-OCT', organizationId: 'ORG-NAVY', month: 'OCTOBER', updatedAt: at('2026-09-28T10:00:00Z') }),
      ]);
      const [navy] = await organizationPayrollStates(db as unknown as Tx, NOW);
      expect(navy.unlocked).toEqual([expect.objectContaining({ ym: '2026-10', regenerateHint: true })]);
    });

    it('is not set when it was generated after the previous month locked', async () => {
      const db = setup([
        variation({ id: 'V-SEP', organizationId: 'ORG-NAVY', month: 'SEPTEMBER', voucher: at('2026-10-02T10:00:00Z') }),
        variation({ id: 'V-OCT', organizationId: 'ORG-NAVY', month: 'OCTOBER', updatedAt: at('2026-10-03T10:00:00Z') }),
      ]);
      const [navy] = await organizationPayrollStates(db as unknown as Tx, NOW);
      expect(navy.unlocked[0].regenerateHint).toBe(false);
    });

    it('counts the audit entry of a voucher that finished processing, which names the voucher, not the variation', async () => {
      const db = setup(
        [
          variation({ id: 'V-SEP', organizationId: 'ORG-NAVY', month: 'SEPTEMBER', voucher: at('2026-10-02T10:00:00Z') }),
          variation({ id: 'V-OCT', organizationId: 'ORG-NAVY', month: 'OCTOBER', updatedAt: at('2026-10-02T10:30:00Z') }),
        ],
        // The voucher row landed at 10:00, its settlement (penalties) finished at 11:00.
        [{ entityId: 'VOUCHER-V-SEP', createdAt: at('2026-10-02T11:00:00Z') }],
      );
      const [navy] = await organizationPayrollStates(db as unknown as Tx, NOW);
      expect(navy.unlocked[0].regenerateHint).toBe(true);
      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityId: { in: expect.arrayContaining(['V-SEP', 'VOUCHER-V-SEP', 'V-OCT']) } }),
        }),
      );
    });

    it('follows a revert: the previous month is unlocked again, but its last lock event came after', async () => {
      const db = setup(
        [
          variation({ id: 'V-SEP', organizationId: 'ORG-NAVY', month: 'SEPTEMBER' }),
          variation({ id: 'V-OCT', organizationId: 'ORG-NAVY', month: 'OCTOBER', updatedAt: at('2026-10-03T10:00:00Z') }),
        ],
        [
          { entityId: 'V-SEP', createdAt: at('2026-10-02T10:00:00Z') },
          { entityId: 'V-SEP', createdAt: at('2026-10-05T10:00:00Z') },
        ],
      );
      const [navy] = await organizationPayrollStates(db as unknown as Tx, NOW);
      expect(navy.unlocked.map((u) => [u.ym, u.regenerateHint])).toEqual([
        ['2026-09', false],
        ['2026-10', true],
      ]);
    });

    it('is never set for the first variation, or when the previous month never locked', async () => {
      const db = setup([
        variation({ id: 'V-SEP', organizationId: 'ORG-NAVY', month: 'SEPTEMBER' }),
        variation({ id: 'V-OCT', organizationId: 'ORG-NAVY', month: 'OCTOBER' }),
      ]);
      const [navy] = await organizationPayrollStates(db as unknown as Tx, NOW);
      expect(navy.unlocked.map((u) => u.regenerateHint)).toEqual([false, false]);
    });
  });
});

describe('mergeBlocker', () => {
  const source = { id: 'S', name: 'Nigerian Navey' };
  const into = { id: 'T', name: 'Nigerian Navy' };
  const sep = { year: 2026, month: 'SEPTEMBER' } as const;
  const oct = { year: 2026, month: 'OCTOBER' } as const;
  const nov = { year: 2026, month: 'NOVEMBER' } as const;
  const v = (organizationId: string, period: MergeVariation['period'], locked = false): MergeVariation => ({
    organizationId,
    period,
    locked,
  });
  const check = (variations: MergeVariation[], earliestOpen = { source: null, into: null } as {
    source: MergeVariation['period'] | null;
    into: MergeVariation['period'] | null;
  }) => mergeBlocker({ source, into, variations, earliestOpen });

  it('lets a misspelling with no variations in', () => {
    expect(check([])).toBeNull();
    expect(check([v('T', oct, true)], { source: nov, into: nov })).toBeNull();
  });

  it('refuses when both have a variation for the same month', () => {
    expect(check([v('S', oct), v('T', oct), v('S', nov), v('T', nov)])).toBe(
      'Nigerian Navey and Nigerian Navy both have a variation for OCTOBER 2026, NOVEMBER 2026, so they can’t be merged',
    );
  });

  it('moves variations for different months, in order', () => {
    expect(check([v('S', oct, true), v('T', nov), v('T', sep, true)])).toBeNull();
  });

  it('refuses a variation still waiting for its voucher behind a locked one', () => {
    expect(check([v('T', sep), v('S', oct, true)])).toBe(
      'Nigerian Navy’s SEPTEMBER 2026 variation is still waiting for its voucher, but Nigerian Navey’s OCTOBER 2026 ' +
        'one is locked, and vouchers go in month order. Finish the earlier month first',
    );
  });

  it('refuses deductions no generation could take: OPEN in a month the other already has a variation for', () => {
    // Navey's loans wait for OCTOBER, and Navy's October is locked.
    expect(check([v('T', oct, true)], { source: oct, into: null })).toContain(
      'Nigerian Navey’s loans have deductions waiting for OCTOBER 2026, but Nigerian Navy already has its OCTOBER 2026 ' +
        'variation locked',
    );
    // ... or already behind it.
    expect(check([v('T', nov)], { source: oct, into: null })).toContain('Nigerian Navey’s loans have deductions waiting for OCTOBER 2026');
    // The other direction: Navy's loans wait for September, Navey's October exists.
    expect(check([v('S', oct)], { source: null, into: sep })).toContain('Nigerian Navy’s loans have deductions waiting for SEPTEMBER 2026');
  });

  it('allows OPEN deductions in the latest variation’s month while it is unlocked (generating it again takes them in), and after it', () => {
    expect(check([v('T', oct)], { source: oct, into: null })).toBeNull();
    expect(check([v('T', oct, true)], { source: nov, into: nov })).toBeNull();
  });
});
