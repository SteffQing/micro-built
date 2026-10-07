import { CONFIRM_KEY, ROLES_KEY } from 'src/auth/decorators';
import type { AuthUser } from 'src/common/types';
import { VariationsController } from './variations.controller';
import type { VariationsAdminService } from './variations.service';

const admin: AuthUser = {
  userId: 'AD-1',
  type: 'ADMIN',
  role: 'SUPER_ADMIN',
  email: 'admin@microbuilt.com',
  status: 'ACTIVE',
  twoFactorEnabled: true,
  hasPasskey: false,
};
const NAVY = { id: 'ORG-NAVY', name: 'Navy' };
const NPF = { id: 'ORG-NPF', name: 'NPF' };
const MONTH = { ym: '2026-10', label: 'OCTOBER 2026' };

describe('VariationsController', () => {
  const service = { preview: jest.fn(), history: jest.fn(), generate: jest.fn(), draft: jest.fn(), fileUrl: jest.fn() };
  const controller = new VariationsController(service as unknown as VariationsAdminService);

  beforeEach(() => jest.resetAllMocks());

  it('is open to every admin, except generating: super admins, with a fresh confirmation', () => {
    expect(Reflect.getMetadata(ROLES_KEY, VariationsController)).toEqual(['ADMIN', 'SUPER_ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, VariationsController.prototype.generate)).toEqual(['SUPER_ADMIN']);
    expect(Reflect.getMetadata(CONFIRM_KEY, VariationsController.prototype.generate)).toMatchObject({ mode: 'action' });
    for (const route of ['preview', 'history', 'draft', 'file'] as const) {
      expect(Reflect.getMetadata(ROLES_KEY, VariationsController.prototype[route])).toBeUndefined();
      expect(Reflect.getMetadata(CONFIRM_KEY, VariationsController.prototype[route])).toBeUndefined();
    }
  });

  it('wraps the preview and the history in the usual envelope', async () => {
    service.preview.mockResolvedValue({ rows: [] });
    await expect(controller.preview({ organizationId: NAVY.id, period: '2026-10' })).resolves.toEqual({
      data: { rows: [] },
      message: 'Payroll changes calculated',
    });
    service.history.mockResolvedValue([]);
    await expect(controller.history({ organizationId: NAVY.id })).resolves.toEqual({
      data: [],
      message: 'Variation history fetched successfully',
    });
  });

  it('generates as the signed-in super admin and says how the organizations were sorted', async () => {
    const data = {
      period: MONTH,
      queued: [NAVY],
      skipped: [{ id: 'ORG-EMPTY', name: 'Empty' }],
      refused: [{ ...NPF, reason: 'Generate NPF’s SEPTEMBER 2026 variation first' }],
    };
    service.generate.mockResolvedValue(data);
    const dto = { period: '2026-10', all: true };
    await expect(controller.generate(dto, admin)).resolves.toEqual({
      data,
      message: '1 variation queued for OCTOBER 2026, 1 skipped (no deductions), 1 refused',
    });
    expect(service.generate).toHaveBeenCalledWith(dto, 'AD-1');
  });

  it('says so when no organization was left to generate for', async () => {
    service.generate.mockResolvedValue({ period: MONTH, queued: [], skipped: [], refused: [] });
    const { message } = await controller.generate({ period: '2026-10', all: true }, admin);
    expect(message).toBe('No organization to generate for in OCTOBER 2026');
  });

  it("always sends the draft to the admin's own email", async () => {
    service.draft.mockResolvedValue({ period: 'OCTOBER 2026', organization: 'Navy', email: 'admin@microbuilt.com' });
    const dto = { organizationId: NAVY.id, period: '2026-10' };
    const { message } = await controller.draft(dto, admin);
    expect(service.draft).toHaveBeenCalledWith(dto, 'admin@microbuilt.com', 'AD-1');
    expect(message).toBe('The OCTOBER 2026 draft for Navy will be emailed to admin@microbuilt.com shortly');
  });

  it('hands the version to the file link', async () => {
    service.fileUrl.mockResolvedValue({ url: 'https://files.example/signed', expiresIn: 600, filename: 'v.xlsx' });
    const { data } = await controller.file('V-1', { version: 2 });
    expect(service.fileUrl).toHaveBeenCalledWith('V-1', { version: 2 });
    expect(data.filename).toBe('v.xlsx');
  });

  it('declares the literal history route before the :id routes', () => {
    const names = Object.getOwnPropertyNames(VariationsController.prototype);
    expect(names.indexOf('history')).toBeLessThan(names.indexOf('file'));
  });
});
