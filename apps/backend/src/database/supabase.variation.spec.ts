import { SupabaseService } from './supabase.service';

describe('Immutable variation upload recovery', () => {
  function storage(existing: Buffer | null) {
    const upload = jest
      .fn()
      .mockResolvedValue({ error: { message: 'Object already exists' } });
    const download = jest
      .fn()
      .mockResolvedValue({
        data: existing ? new Blob([new Uint8Array(existing)]) : null,
      });
    const service = Object.create(SupabaseService.prototype) as SupabaseService;
    Object.assign(service, {
      VARIATION_BUCKET: 'variation',
      supabase: { storage: { from: () => ({ upload, download }) } },
    });
    return { service, upload, download };
  }
  it('recovers an identical upload after a worker crashes before recording the hash', async () => {
    const { service, upload } = storage(Buffer.from('saved-file'));
    await expect(
      service.uploadVariationScheduleDoc(
        Buffer.from('saved-file'),
        'SEPTEMBER 2026',
        'VAR-1',
        'PREPARED',
      ),
    ).resolves.toBe('2026/SEPTEMBER/VAR-1-prepared.xlsx');
    expect(upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      expect.objectContaining({ upsert: false }),
    );
  });
  it('never overwrites a different existing file', async () => {
    const { service } = storage(Buffer.from('original-file'));
    await expect(
      service.uploadVariationScheduleDoc(
        Buffer.from('different-file'),
        'SEPTEMBER 2026',
        'VAR-1',
        'PREPARED',
      ),
    ).rejects.toThrow('Object already exists');
  });
  it('does not hide an upload failure when no file exists', async () => {
    const { service } = storage(null);
    await expect(
      service.uploadVariationScheduleDoc(
        Buffer.from('new-file'),
        'SEPTEMBER 2026',
        'VAR-1',
        'PREPARED',
      ),
    ).rejects.toThrow('Variation artifact upload failed');
  });
});
