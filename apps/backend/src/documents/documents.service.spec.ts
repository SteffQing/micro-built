import { captureJobError } from 'src/common/observability';
import { DOWNLOAD_LINK_TTL_SECONDS, DocumentsService, EXPORTS_BUCKET } from './documents.service';

jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

describe('DocumentsService.deliver', () => {
  const supabase = {
    uploadPrivate: jest.fn().mockResolvedValue('stored'),
    signedUrl: jest.fn().mockResolvedValue('https://files.example/signed'),
  };
  const inapp = { messageUser: jest.fn().mockResolvedValue(undefined) };
  const mail = { sendCustomerNotification: jest.fn().mockResolvedValue(undefined) };
  const service = new DocumentsService(supabase as never, inapp as never, mail as never);
  const body = Buffer.from('file');
  const doc = {
    userId: 'AD-1',
    title: 'Cash loans export ready',
    message: 'Your cash loans export is ready.',
    fileName: 'cash-loans-2026-10-01.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body,
  };

  beforeEach(() => jest.clearAllMocks());

  it('stores the file privately under the user, signs a 7-day download link and sends it in-app and by email', async () => {
    const result = await service.deliver({ ...doc, email: 'admin@microbuilt.com' });

    const [bucket, path, uploaded, type] = supabase.uploadPrivate.mock.calls[0];
    expect(bucket).toBe(EXPORTS_BUCKET);
    expect(path).toMatch(/^AD-1\/\d+-cash-loans-2026-10-01\.xlsx$/);
    expect(uploaded).toBe(body);
    expect(type).toBe(doc.contentType);
    expect(supabase.signedUrl).toHaveBeenCalledWith(EXPORTS_BUCKET, path, DOWNLOAD_LINK_TTL_SECONDS, doc.fileName);
    expect(DOWNLOAD_LINK_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(inapp.messageUser).toHaveBeenCalledWith({
      userId: 'AD-1',
      title: doc.title,
      message: doc.message,
      callToActionUrl: 'https://files.example/signed',
    });
    expect(mail.sendCustomerNotification).toHaveBeenCalledWith('admin@microbuilt.com', {
      title: doc.title,
      message: doc.message,
      ctaUrl: 'https://files.example/signed',
      ctaText: 'Download',
    });
    expect(result).toEqual({ path, url: 'https://files.example/signed', emailed: true });
  });

  it('gives a phone-only customer (placeholder or no address) the in-app link only', async () => {
    await service.deliver({ ...doc, userId: 'MB-1', email: '2348012345678@phone.microbuiltprime.com' });
    await service.deliver({ ...doc, userId: 'MB-1' });

    expect(inapp.messageUser).toHaveBeenCalledTimes(2);
    expect(mail.sendCustomerNotification).not.toHaveBeenCalled();
  });

  it('reports a failed email without failing: the link is already in-app', async () => {
    mail.sendCustomerNotification.mockRejectedValueOnce(new Error('Resend down'));

    await expect(service.deliver({ ...doc, email: 'admin@microbuilt.com' })).resolves.toMatchObject({ emailed: false });
    expect(inapp.messageUser).toHaveBeenCalledTimes(1);
    expect(captureJobError).toHaveBeenCalledTimes(1);
  });

  it('notifies no one when the upload fails', async () => {
    supabase.uploadPrivate.mockRejectedValueOnce(new Error('Storage down'));

    await expect(service.deliver({ ...doc, email: 'admin@microbuilt.com' })).rejects.toThrow('Storage down');
    expect(inapp.messageUser).not.toHaveBeenCalled();
    expect(mail.sendCustomerNotification).not.toHaveBeenCalled();
  });
});
