jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LiquidationRequestsService } from './liquidation-requests.service';

const pdf = { buffer: Buffer.from('%PDF-1.7 proof'), size: 14 } as Express.Multer.File;

function setup() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Ada Obi' }) },
    paymentInflow: { findUnique: jest.fn() },
  };
  const supabase = {
    uploadPrivate: jest.fn().mockResolvedValue(undefined),
    removePrivate: jest.fn().mockResolvedValue(undefined),
    signedUrl: jest.fn().mockResolvedValue('https://signed.example/proof'),
  };
  const liquidations = {
    request: jest.fn((input: { id: string }) =>
      Promise.resolve({ id: input.id, amount: new Prisma.Decimal(5000), state: 'AWAITING', createdAt: new Date() }),
    ),
  };
  const notifier = { notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  const service = new LiquidationRequestsService(
    prisma as never,
    supabase as never,
    liquidations as never,
    notifier as never,
  );
  return { service, prisma, supabase, liquidations, notifier };
}

describe('LiquidationRequestsService.create', () => {
  it('stores the proof under the inflow id, records the request and tells the super admins', async () => {
    const { service, supabase, liquidations, notifier } = setup();
    const result = await service.create('MB-1', 5000, pdf);

    const [bucket, path, , mime] = supabase.uploadPrivate.mock.calls[0] as [string, string, Buffer, string];
    expect([bucket, mime]).toEqual(['liquidation-proofs', 'application/pdf']);
    expect(path).toBe(`MB-1/${result.id}.pdf`);
    expect(liquidations.request).toHaveBeenCalledWith({ id: result.id, customerId: 'MB-1', amount: 5000, proofPath: path });
    expect(result).toMatchObject({ amount: 5000, state: 'AWAITING' });
    await new Promise(setImmediate);
    expect(notifier.notifyAdmins).toHaveBeenCalledWith(['SUPER_ADMIN'], expect.objectContaining({ title: 'Liquidation request' }));
  });

  it('removes the stored proof when the ledger refuses the request', async () => {
    const { service, supabase, liquidations } = setup();
    liquidations.request.mockRejectedValueOnce(new ConflictException('That is more than the ₦4,000.00 still owed'));
    await expect(service.create('MB-1', 5000, pdf)).rejects.toThrow('more than');
    const [, path] = supabase.uploadPrivate.mock.calls[0] as [string, string];
    expect(supabase.removePrivate).toHaveBeenCalledWith('liquidation-proofs', path);
  });

  it('checks the file before storing anything', async () => {
    const { service, supabase } = setup();
    const zip = { buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), size: 4 } as Express.Multer.File;
    await expect(service.create('MB-1', 5000, zip)).rejects.toThrow('must be a PDF, JPG or PNG');
    expect(supabase.uploadPrivate).not.toHaveBeenCalled();
  });
});

describe('LiquidationRequestsService.proofUrl', () => {
  it("never opens another customer's proof", async () => {
    const { service, prisma, supabase } = setup();
    prisma.paymentInflow.findUnique.mockResolvedValue({ source: 'LIQUIDATION', customerId: 'MB-2', proofPath: 'MB-2/x.pdf' });
    await expect(service.proofUrl('x', 'MB-1')).rejects.toThrow(NotFoundException);
    expect(supabase.signedUrl).not.toHaveBeenCalled();
  });

  it('signs a 5-minute link named after the file', async () => {
    const { service, prisma, supabase } = setup();
    prisma.paymentInflow.findUnique.mockResolvedValue({ source: 'LIQUIDATION', customerId: 'MB-1', proofPath: 'MB-1/x.pdf' });
    await expect(service.proofUrl('x', 'MB-1')).resolves.toBe('https://signed.example/proof');
    expect(supabase.signedUrl).toHaveBeenCalledWith('liquidation-proofs', 'MB-1/x.pdf', 300, 'x.pdf');
  });
});
