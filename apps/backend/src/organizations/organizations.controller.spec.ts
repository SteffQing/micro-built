import { CONFIRM_KEY, ROLES_KEY } from 'src/auth/decorators';
import { OrganizationsController } from './organizations.controller';
import type { OrganizationsService } from './organizations.service';

const proto = OrganizationsController.prototype;
const rolesOf = (handler: object) => Reflect.getMetadata(ROLES_KEY, handler) as string[];

describe('OrganizationsController', () => {
  const service = { list: jest.fn(), merge: jest.fn(), requestSwitches: jest.fn() };
  const controller = new OrganizationsController(service as unknown as OrganizationsService);
  const user = { userId: 'admin-1' } as never;

  beforeEach(() => jest.clearAllMocks());

  it('is open to admins, and to marketers for the list (the onboarding form)', () => {
    expect(rolesOf(OrganizationsController)).toEqual(['ADMIN', 'SUPER_ADMIN']);
    expect(rolesOf(proto.list)).toEqual(['ADMIN', 'SUPER_ADMIN', 'MARKETER']);
    expect(Reflect.getMetadata(ROLES_KEY, proto.switchRequests)).toBeUndefined();
  });

  it('merges only for a super admin, with a confirmation each time', () => {
    expect(rolesOf(proto.merge)).toEqual(['SUPER_ADMIN']);
    expect(Reflect.getMetadata(CONFIRM_KEY, proto.merge)).toEqual({ mode: 'action' });
  });

  it('wraps the merge result', async () => {
    service.merge.mockResolvedValue({ intoId: 'T', movedPayrolls: 3, movedVariations: 0 });
    await expect(controller.merge('S', { intoId: 'T' }, user)).resolves.toEqual({
      data: { intoId: 'T', movedPayrolls: 3, movedVariations: 0 },
      message: 'Organizations merged',
    });
    expect(service.merge).toHaveBeenCalledWith('S', 'T', 'admin-1');
  });

  it('answers a switch request per id, and says how many wait for a super admin', async () => {
    service.requestSwitches.mockResolvedValue([
      { externalId: 'PF1', outcome: 'CREATED', requestId: 'CR-1' },
      { externalId: 'PF2', outcome: 'NOT_FOUND' },
      { externalId: 'PF3', outcome: 'CREATED', requestId: 'CR-3' },
    ]);
    const response = await controller.switchRequests('T', { externalIds: ['PF1', 'PF2', 'PF3'] }, user);
    expect(response.data.results).toHaveLength(3);
    expect(response.message).toBe("2 organization changes waiting for a super admin's approval");
    expect(service.requestSwitches).toHaveBeenCalledWith('T', ['PF1', 'PF2', 'PF3'], 'admin-1');

    service.requestSwitches.mockResolvedValue([{ externalId: 'PF1', outcome: 'ALREADY_IN_ORGANIZATION' }]);
    expect((await controller.switchRequests('T', { externalIds: ['PF1'] }, user)).message).toBe(
      'No organization change was needed',
    );
  });
});
