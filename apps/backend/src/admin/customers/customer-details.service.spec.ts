jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { CustomerDetailsService } from './customer-details.service';

function setup() {
  const tx = {};
  const prisma = {
    customer: {
      findUnique: jest.fn().mockResolvedValue({ externalId: null, user: { name: 'John Doe' } }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    customerIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
    customerPaymentMethod: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
  };
  const ledgerTx = {
    transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) => work(tx)),
    audit: jest.fn(),
  };
  const changeRequests = {
    submit: jest.fn().mockResolvedValue({ id: 'cr1' }),
    get: jest.fn().mockResolvedValue({ id: 'cr1', status: 'PENDING' }),
  };
  const service = new CustomerDetailsService(prisma as never, ledgerTx as never, changeRequests as never);
  return { service, prisma, ledgerTx, changeRequests, tx };
}

const bank = { bankName: 'Kuda MFB', accountNumber: '2222222222', accountName: 'John Doe', bvn: '22222222222' };

describe('admin proposals for a customer', () => {
  it('a full set of bank details for a customer with none becomes a proposal by the admin, audited', async () => {
    const { service, changeRequests, ledgerTx, tx } = setup();
    const result = await service.proposePaymentMethod('MB-1', bank, 'AD-1');
    expect(changeRequests.submit).toHaveBeenCalledWith(tx, 'MB-1', 'PAYMENT_METHOD', bank, {}, 'AD-1');
    expect(ledgerTx.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'CHANGE_REQUEST_PROPOSED', entityId: 'cr1' }));
    expect(result.message).toBe("The change to John Doe's bank details is waiting for a super admin's approval");
  });

  it('with nothing on file, every field is needed (approving creates the record)', async () => {
    const { service, changeRequests } = setup();
    await expect(service.proposePaymentMethod('MB-1', { bankName: 'Kuda MFB' }, 'AD-1')).rejects.toThrow(
      new BadRequestException(
        'The customer has no bank details yet, so give all of them. Missing: account number, account name, BVN',
      ),
    );
    expect(changeRequests.submit).not.toHaveBeenCalled();
  });

  it('a partial identity change is fine once identity is on file', async () => {
    const { service, prisma, changeRequests } = setup();
    prisma.customerIdentity.findUnique.mockResolvedValue({
      dateOfBirth: new Date('1990-01-02'),
      gender: 'MALE',
      maritalStatus: 'SINGLE',
      residencyAddress: '1 Road',
      stateResidency: 'Lagos',
      landmarkOrBusStop: 'Stop',
      nextOfKinName: 'Jane',
      nextOfKinContact: '0801',
      nextOfKinAddress: '1 Road',
      nextOfKinRelationship: 'SIBLING',
    });
    await service.proposeIdentity('MB-1', { stateResidency: 'Ogun' }, 'AD-1');
    expect(changeRequests.submit).toHaveBeenCalledWith(
      expect.anything(),
      'MB-1',
      'IDENTITY',
      { stateResidency: 'Ogun' },
      expect.objectContaining({ dateOfBirth: '1990-01-02', stateResidency: 'Lagos' }),
      'AD-1',
    );
  });

  it('refuses an account number or IPPIS number that belongs to another customer', async () => {
    const { service, prisma } = setup();
    prisma.customerPaymentMethod.findFirst.mockResolvedValue({ accountNumber: bank.accountNumber });
    await expect(service.proposePaymentMethod('MB-1', bank, 'AD-1')).rejects.toThrow(
      new ConflictException('This account number belongs to another customer'),
    );
    prisma.customer.findFirst.mockResolvedValue({ userId: 'MB-2' });
    await expect(
      service.proposePayroll('MB-1', { externalId: 'PF1', command: 'Lagos', organization: 'NPF' }, 'AD-1'),
    ).rejects.toThrow(new ConflictException('IPPIS PF1 belongs to another customer'));
  });

  it('payroll can only be proposed while there is none', async () => {
    const { service, prisma } = setup();
    prisma.customer.findUnique.mockResolvedValue({ externalId: 'PF9', user: { name: 'John Doe' } });
    await expect(
      service.proposePayroll('MB-1', { externalId: 'PF1', command: 'Lagos', organization: 'NPF' }, 'AD-1'),
    ).rejects.toThrow(ConflictException);
  });
});
