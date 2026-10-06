import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ALREADY_DECIDED } from 'src/ledger/ledger.constants';
import { RATES_NOT_SET } from 'src/settings/settings.service';
import { CashLoanService, CommodityLoanService } from './loan.service';
import { TopupService } from './topup.service';

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const rates = { interestRate: decimal('0.03'), managementFeeRate: decimal('0.025') };

function setup() {
  const tx = {
    loan: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    commodityLoan: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    // The approval guard's lookup: by default the borrower has identity and payroll on file.
    loan: { findUnique: jest.fn().mockResolvedValue({ borrower: { identity: { userId: 'MB-1' }, payroll: { externalId: 'PF1' } } }) },
    commodityLoan: { findUnique: jest.fn() },
    microLoan: { findFirst: jest.fn() },
  };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)),
    run: jest.fn((given: typeof tx | undefined, work: (t: typeof tx) => Promise<unknown>) => work(given ?? tx)),
    audit: jest.fn(),
  };
  const ledger = {
    disburseLoan: jest.fn(),
    requestTopup: jest.fn().mockResolvedValue({ id: 'TOPUP-1' }),
    approveTopup: jest.fn(),
    rejectTopup: jest.fn(),
    disburseTopup: jest.fn(),
  };
  const settings = { requireRates: jest.fn().mockResolvedValue(rates) };
  const deps = [prisma, ledgerTx, ledger, settings] as never[];
  return {
    tx,
    prisma,
    ledgerTx,
    ledger,
    settings,
    cash: new CashLoanService(...(deps as [never, never, never, never])),
    commodity: new CommodityLoanService(...(deps as [never, never, never, never])),
    topups: new TopupService(prisma as never, ledgerTx as never, ledger as never),
  };
}

const auditActions = (audit: jest.Mock) => audit.mock.calls.map(([, entry]) => (entry as { action: string }).action);

describe('CashLoanService', () => {
  describe('approveLoan', () => {
    it('refuses a borrower without identity or payroll details on file, naming what is missing', async () => {
      const { cash, prisma, tx } = setup();
      prisma.loan.findUnique.mockResolvedValueOnce({ borrower: { identity: null, payroll: null } });
      await expect(cash.approveLoan('LN-1', { tenure: 6 }, 'AD-1')).rejects.toThrow(
        "Add the customer's identity details and payroll data before approving this loan",
      );
      expect(tx.loan.updateMany).not.toHaveBeenCalled();
    });

    it('skips that check inside onboarding, which approves before identity exists', async () => {
      const { cash, prisma, tx } = setup();
      tx.loan.findUnique.mockResolvedValue({ status: 'PENDING', category: 'PERSONAL', principal: decimal(100000) });
      await cash.approveLoan('LN-1', { tenure: 6 }, 'AD-1', tx as never);
      expect(prisma.loan.findUnique).not.toHaveBeenCalled();
    });

    it('snapshots the Settings rates and the tenure with a compare-and-swap on PENDING', async () => {
      const { cash, tx, ledgerTx } = setup();
      tx.loan.findUnique.mockResolvedValue({ status: 'PENDING', category: 'PERSONAL', principal: decimal(100000) });

      await cash.approveLoan('LN-1', { tenure: 6 }, 'AD-1');

      expect(tx.loan.updateMany).toHaveBeenCalledWith({
        where: { id: 'LN-1', status: 'PENDING' },
        data: { status: 'APPROVED', tenure: 6, ...rates },
      });
      expect(ledgerTx.audit).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ actorId: 'AD-1', action: 'LOAN_APPROVED', entityType: 'LOAN', entityId: 'LN-1' }),
      );
    });

    it('answers 409 when another admin decided first', async () => {
      const { cash, tx, ledgerTx } = setup();
      tx.loan.findUnique.mockResolvedValue({ status: 'PENDING', category: 'PERSONAL', principal: decimal(100000) });
      tx.loan.updateMany.mockResolvedValue({ count: 0 });

      await expect(cash.approveLoan('LN-1', { tenure: 6 }, 'AD-1')).rejects.toThrow(
        new ConflictException(ALREADY_DECIDED),
      );
      expect(ledgerTx.audit).not.toHaveBeenCalled();
    });

    it('answers 409 until the rates are set, before touching the loan', async () => {
      const { cash, tx, settings } = setup();
      settings.requireRates.mockRejectedValue(new ConflictException(RATES_NOT_SET));

      await expect(cash.approveLoan('LN-1', { tenure: 6 }, 'AD-1')).rejects.toThrow(RATES_NOT_SET);
      expect(tx.loan.findUnique).not.toHaveBeenCalled();
    });

    it('sends asset loans to their asset request', async () => {
      const { cash, tx } = setup();
      tx.loan.findUnique.mockResolvedValue({ status: 'PENDING', category: 'ASSET_PURCHASE', principal: decimal(0) });

      await expect(cash.approveLoan('LN-1', { tenure: 6 }, 'AD-1')).rejects.toThrow(
        'Approve an asset loan from its asset request',
      );
      expect(tx.loan.updateMany).not.toHaveBeenCalled();
    });

    it('runs inside a caller transaction when given one', async () => {
      const { cash, ledgerTx } = setup();
      const outer = {
        loan: {
          findUnique: jest.fn().mockResolvedValue({ status: 'PENDING', category: 'RENT', principal: decimal(5000) }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      await cash.approveLoan('LN-1', { tenure: 3 }, 'AD-1', outer as never);

      expect(ledgerTx.run).toHaveBeenCalledWith(outer, expect.any(Function));
      expect(outer.loan.updateMany).toHaveBeenCalled();
    });
  });

  describe('rejectLoan', () => {
    it('rejects a pending or approved loan, audits the note and rejects its asset requests', async () => {
      const { cash, tx, ledgerTx } = setup();
      tx.loan.findUnique.mockResolvedValue({ status: 'APPROVED' });
      tx.commodityLoan.findMany.mockResolvedValue([{ id: 'CL-1' }]);

      await cash.rejectLoan('LN-1', { note: 'Net pay too low' }, 'AD-1');

      expect(tx.loan.updateMany).toHaveBeenCalledWith({
        where: { id: 'LN-1', status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'REJECTED' },
      });
      expect(tx.commodityLoan.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['CL-1'] } },
        data: { status: 'REJECTED' },
      });
      expect(ledgerTx.audit).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'LOAN_REJECTED', entityId: 'LN-1', note: 'Net pay too low' }),
      );
      expect(auditActions(ledgerTx.audit)).toEqual(['LOAN_REJECTED', 'COMMODITY_REJECTED']);
    });

    it('refuses a disbursed loan', async () => {
      const { cash, tx } = setup();
      tx.loan.findUnique.mockResolvedValue({ status: 'DISBURSED' });

      await expect(cash.rejectLoan('LN-1', {}, 'AD-1')).rejects.toThrow(ConflictException);
      expect(tx.loan.updateMany).not.toHaveBeenCalled();
    });

    it('answers 409 when another admin decided first', async () => {
      const { cash, tx } = setup();
      tx.loan.findUnique.mockResolvedValue({ status: 'PENDING' });
      tx.loan.updateMany.mockResolvedValue({ count: 0 });

      await expect(cash.rejectLoan('LN-1', {}, 'AD-1')).rejects.toThrow(ALREADY_DECIDED);
    });
  });

  describe('disburseLoan', () => {
    const approved = (status = 'ACTIVE') => ({ status: 'APPROVED', borrower: { user: { status } } });

    it('checks the rates, then disburses through the ledger as the admin', async () => {
      const { cash, prisma, settings, ledger } = setup();
      prisma.loan.findUnique.mockResolvedValue(approved());

      await cash.disburseLoan('LN-1', 'AD-SUPER');

      expect(settings.requireRates).toHaveBeenCalled();
      expect(ledger.disburseLoan).toHaveBeenCalledWith('LN-1', 'AD-SUPER');
    });

    it('answers 409 until the rates are set', async () => {
      const { cash, prisma, settings, ledger } = setup();
      prisma.loan.findUnique.mockResolvedValue(approved());
      settings.requireRates.mockRejectedValue(new ConflictException(RATES_NOT_SET));

      await expect(cash.disburseLoan('LN-1', 'AD-SUPER')).rejects.toThrow(RATES_NOT_SET);
      expect(ledger.disburseLoan).not.toHaveBeenCalled();
    });

    it('refuses a flagged customer', async () => {
      const { cash, prisma, ledger } = setup();
      prisma.loan.findUnique.mockResolvedValue(approved('FLAGGED'));

      await expect(cash.disburseLoan('LN-1', 'AD-SUPER')).rejects.toThrow(BadRequestException);
      expect(ledger.disburseLoan).not.toHaveBeenCalled();
    });

    it('404s an unknown loan', async () => {
      const { cash, prisma } = setup();
      prisma.loan.findUnique.mockResolvedValue(null);

      await expect(cash.disburseLoan('LN-X', 'AD-SUPER')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('CommodityLoanService', () => {
  const details = { publicDetails: 'HP EliteBook', privateDetails: 'Slot Ikeja, ₦410,000', amount: 450000 };

  describe('approving a request that opens an asset loan', () => {
    const pendingAssetLoan = {
      status: 'IN_REVIEW',
      loanId: 'LN-1',
      loan: { status: 'PENDING', category: 'ASSET_PURCHASE' },
    };

    it('approves the request and the loan with amount, tenure and rates, and audits both', async () => {
      const { commodity, prisma, tx, ledgerTx, ledger } = setup();
      prisma.commodityLoan.findUnique.mockResolvedValue(pendingAssetLoan);

      await commodity.approveCommodityLoan('CL-1', { ...details, tenure: 12 }, 'AD-1');

      expect(tx.commodityLoan.updateMany).toHaveBeenCalledWith({
        where: { id: 'CL-1', status: 'IN_REVIEW' },
        data: { status: 'APPROVED', publicDetails: details.publicDetails, privateDetails: details.privateDetails },
      });
      const [{ where, data }] = tx.loan.updateMany.mock.calls[0] as [
        { where: unknown; data: { principal: Prisma.Decimal } & Record<string, unknown> },
      ];
      expect(where).toEqual({ id: 'LN-1', status: 'PENDING' });
      expect(data).toMatchObject({ status: 'APPROVED', tenure: 12, ...rates });
      expect(data.principal.toString()).toBe('450000');
      expect(auditActions(ledgerTx.audit)).toEqual(['COMMODITY_APPROVED', 'LOAN_APPROVED']);
      expect(ledger.requestTopup).not.toHaveBeenCalled();
    });

    it('needs a tenure and refuses monthsDelta', async () => {
      const { commodity, prisma, tx } = setup();
      prisma.commodityLoan.findUnique.mockResolvedValue(pendingAssetLoan);

      await expect(commodity.approveCommodityLoan('CL-1', details, 'AD-1')).rejects.toThrow(BadRequestException);
      await expect(
        commodity.approveCommodityLoan('CL-1', { ...details, tenure: 6, monthsDelta: 2 }, 'AD-1'),
      ).rejects.toThrow(BadRequestException);
      expect(tx.commodityLoan.updateMany).not.toHaveBeenCalled();
    });

    it('answers 409 until the rates are set', async () => {
      const { commodity, prisma, settings, tx } = setup();
      prisma.commodityLoan.findUnique.mockResolvedValue(pendingAssetLoan);
      settings.requireRates.mockRejectedValue(new ConflictException(RATES_NOT_SET));

      await expect(commodity.approveCommodityLoan('CL-1', { ...details, tenure: 6 }, 'AD-1')).rejects.toThrow(
        RATES_NOT_SET,
      );
      expect(tx.commodityLoan.updateMany).not.toHaveBeenCalled();
    });

    it('answers 409 when another admin decided first', async () => {
      const { commodity, prisma, tx } = setup();
      prisma.commodityLoan.findUnique.mockResolvedValue(pendingAssetLoan);
      tx.commodityLoan.updateMany.mockResolvedValue({ count: 0 });

      await expect(commodity.approveCommodityLoan('CL-1', { ...details, tenure: 6 }, 'AD-1')).rejects.toThrow(
        ALREADY_DECIDED,
      );
      expect(tx.loan.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('approving an asset top-up on a running loan', () => {
    const onRunningLoan = { status: 'IN_REVIEW', loanId: 'LN-1', loan: { status: 'DISBURSED', category: 'PERSONAL' } };

    it('requests and approves a top-up for it in the same transaction', async () => {
      const { commodity, prisma, tx, ledger, ledgerTx } = setup();
      prisma.commodityLoan.findUnique.mockResolvedValue(onRunningLoan);

      await commodity.approveCommodityLoan('CL-2', { ...details, monthsDelta: 3 }, 'AD-1');

      expect(ledgerTx.transaction).toHaveBeenCalledTimes(1);
      const [request, requestTx] = ledger.requestTopup.mock.calls[0] as [
        { amount: Prisma.Decimal } & Record<string, unknown>,
        unknown,
      ];
      expect(request).toMatchObject({ loanId: 'LN-1', commodityLoanId: 'CL-2', requestedById: 'AD-1', monthsDelta: 3 });
      expect(request.amount.toString()).toBe('450000');
      expect(requestTx).toBe(tx);
      expect(ledger.approveTopup).toHaveBeenCalledWith('TOPUP-1', 'AD-1', tx);
      expect(tx.loan.updateMany).not.toHaveBeenCalled();
      expect(auditActions(ledgerTx.audit)).toEqual(['COMMODITY_APPROVED']);
    });

    it('refuses a tenure (send monthsDelta)', async () => {
      const { commodity, prisma, ledger } = setup();
      prisma.commodityLoan.findUnique.mockResolvedValue(onRunningLoan);

      await expect(commodity.approveCommodityLoan('CL-2', { ...details, tenure: 12 }, 'AD-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(ledger.requestTopup).not.toHaveBeenCalled();
    });
  });

  it('refuses a request whose loan is no longer open', async () => {
    const { commodity, prisma } = setup();
    prisma.commodityLoan.findUnique.mockResolvedValue({
      status: 'IN_REVIEW',
      loanId: 'LN-1',
      loan: { status: 'REPAID', category: 'ASSET_PURCHASE' },
    });

    await expect(commodity.approveCommodityLoan('CL-1', { ...details, tenure: 6 }, 'AD-1')).rejects.toThrow(
      'This request can no longer be approved: its loan is repaid',
    );
  });

  it('rejecting a request also rejects the pending asset loan it would have opened', async () => {
    const { commodity, tx, ledgerTx } = setup();
    tx.commodityLoan.findUnique.mockResolvedValue({
      loanId: 'LN-1',
      loan: { status: 'PENDING', category: 'ASSET_PURCHASE' },
    });

    await commodity.rejectCommodityLoan('CL-1', { note: 'Out of stock' }, 'AD-1');

    expect(tx.commodityLoan.updateMany).toHaveBeenCalledWith({
      where: { id: 'CL-1', status: 'IN_REVIEW' },
      data: { status: 'REJECTED' },
    });
    expect(tx.loan.updateMany).toHaveBeenCalledWith({
      where: { id: 'LN-1', status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    expect(ledgerTx.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'COMMODITY_REJECTED', entityId: 'CL-1', note: 'Out of stock' }),
    );
    expect(auditActions(ledgerTx.audit)).toEqual(['COMMODITY_REJECTED', 'LOAN_REJECTED']);
  });

  it('rejecting an asset top-up request leaves the running loan alone', async () => {
    const { commodity, tx } = setup();
    tx.commodityLoan.findUnique.mockResolvedValue({ loanId: 'LN-1', loan: { status: 'DISBURSED', category: 'RENT' } });

    await commodity.rejectCommodityLoan('CL-2', {}, 'AD-1');

    expect(tx.loan.updateMany).not.toHaveBeenCalled();
  });
});

describe('TopupService', () => {
  it('approves through the ledger', async () => {
    const { topups, ledger } = setup();
    await topups.approve('TOPUP-1', 'AD-1', { monthsDelta: 2, reprice: true });
    expect(ledger.approveTopup).toHaveBeenCalledWith('TOPUP-1', 'AD-1', undefined, { monthsDelta: 2, reprice: true });
  });

  it('rejecting a top-up also rejects the asset request it pays for', async () => {
    const { topups, ledger, tx, ledgerTx } = setup();
    tx.commodityLoan.findFirst.mockResolvedValue({ id: 'CL-2' });

    await topups.reject('TOPUP-1', 'AD-1', 'Too soon');

    expect(ledger.rejectTopup).toHaveBeenCalledWith('TOPUP-1', 'AD-1', 'Too soon', tx);
    expect(tx.commodityLoan.update).toHaveBeenCalledWith({ where: { id: 'CL-2' }, data: { status: 'REJECTED' } });
    expect(auditActions(ledgerTx.audit)).toEqual(['COMMODITY_REJECTED']);
  });

  it('disburses through the ledger, but not to a deactivated customer', async () => {
    const { topups, prisma, ledger } = setup();
    prisma.microLoan.findFirst.mockResolvedValue({ loan: { borrower: { user: { status: 'ACTIVE' } } } });
    await topups.disburse('TOPUP-1', 'AD-SUPER');
    expect(ledger.disburseTopup).toHaveBeenCalledWith('TOPUP-1', 'AD-SUPER');

    prisma.microLoan.findFirst.mockResolvedValue({ loan: { borrower: { user: { status: 'INACTIVE' } } } });
    await expect(topups.disburse('TOPUP-2', 'AD-SUPER')).rejects.toThrow(BadRequestException);
    expect(ledger.disburseTopup).toHaveBeenCalledTimes(1);
  });
});
