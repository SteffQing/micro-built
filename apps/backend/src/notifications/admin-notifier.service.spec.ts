import { AdminNotifierService } from './admin-notifier.service';

function setup(admins: { userId: string }[] = [{ userId: 'AD-1' }, { userId: 'AD-2' }]) {
  const prisma = { admin: { findMany: jest.fn().mockResolvedValue(admins) } };
  const inapp = { messageUsers: jest.fn() };
  return { prisma, inapp, notifier: new AdminNotifierService(prisma as never, inapp as never) };
}

describe('AdminNotifierService.notifyAdmins', () => {
  it('sends one in-app notification to every active admin with those roles, never the system actor', async () => {
    const { prisma, inapp, notifier } = setup();
    await notifier.notifyAdmins(['ADMIN', 'SUPER_ADMIN', 'SYSTEM'], {
      title: 'Tenure Change Proposed',
      message: 'Review it',
      ctaUrl: '/admin/tenure-changes',
    });
    expect(prisma.admin.findMany).toHaveBeenCalledWith({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, userId: { not: 'system' }, user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    expect(inapp.messageUsers).toHaveBeenCalledWith(['AD-1', 'AD-2'], {
      title: 'Tenure Change Proposed',
      message: 'Review it',
      callToActionUrl: '/admin/tenure-changes',
    });
  });

  it('asks for nobody when only the system role is named', async () => {
    const { prisma, inapp, notifier } = setup();
    await notifier.notifyAdmins(['SYSTEM'], { title: 'x', message: 'y' });
    expect(prisma.admin.findMany).not.toHaveBeenCalled();
    expect(inapp.messageUsers).not.toHaveBeenCalled();
  });
});
