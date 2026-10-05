import { Injectable, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// File storage (D10): everything is private except avatars. The database stores object paths;
// readers get short-lived signed URLs (signedUrl) or the bytes (downloadPrivate).
@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private AVATAR_BUCKET = 'user-avatar';

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  // Private buckets already checked this process.
  private readonly privateBuckets = new Set<string>();

  /** Uploads (or replaces) a file in a private bucket, creating the bucket on first use. */
  async uploadPrivate(bucket: string, path: string, body: Buffer, contentType: string): Promise<string> {
    await this.ensurePrivateBucket(bucket);
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, body, { contentType, upsert: true });
    if (error) throw new Error(`Upload to ${bucket}/${path} failed: ${error.message}`);
    return data.path;
  }

  /**
   * A link to a private file that stops working after `expiresInSeconds`. `downloadName` makes
   * the browser save it under that name instead of opening it.
   */
  async signedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
    downloadName?: string,
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds, downloadName ? { download: downloadName } : undefined);
    if (error || !data) {
      if (isMissing(error)) throw new NotFoundException('File not found');
      throw new Error(`Signing ${bucket}/${path} failed: ${error?.message ?? 'no URL returned'}`);
    }
    return data.signedUrl;
  }

  /** The bytes of a private file (e.g. a stored payroll sheet a job processes). */
  async downloadPrivate(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage.from(bucket).download(path);
    if (error || !data) {
      if (isMissing(error)) throw new NotFoundException('File not found');
      throw new Error(`Download of ${bucket}/${path} failed: ${error?.message ?? 'empty response'}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  /** Removes a private file, e.g. an upload whose database row could not be written. */
  async removePrivate(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(bucket).remove([path]);
    if (error && !isMissing(error)) throw new Error(`Removing ${bucket}/${path} failed: ${error.message}`);
  }

  private async ensurePrivateBucket(bucket: string): Promise<void> {
    if (this.privateBuckets.has(bucket)) return;
    const { data } = await this.supabase.storage.getBucket(bucket);
    if (!data) {
      const { error } = await this.supabase.storage.createBucket(bucket, { public: false });
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(`Creating bucket ${bucket} failed: ${error.message}`);
      }
    } else if (data.public) {
      throw new Error(`Bucket ${bucket} is public; private files can't go there`);
    }
    this.privateBuckets.add(bucket);
  }

  async ping() {
    const { data, error } = await this.supabase.storage.listBuckets();
    if (error) throw error;
    return { status: 'alive', bucketCount: data.length };
  }

  /** Avatars are the one public bucket: the URL is stored on the user as-is. */
  async uploadUserAvatar(file: Express.Multer.File, userId: string) {
    return this.uploadAvatar(userId, file.buffer, file.mimetype);
  }

  /**
   * Puts an avatar at `path` in the public bucket and returns its URL. An approved avatar change
   * gets its own path, so the live one is only replaced when the user row points at the new URL.
   */
  async uploadAvatar(path: string, body: Buffer, contentType: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.AVATAR_BUCKET)
      .upload(path, body, { contentType, duplex: 'half', upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return this.supabase.storage.from(this.AVATAR_BUCKET).getPublicUrl(data.path).data.publicUrl;
  }
}

// Storage answers a missing object with a 400 or 404 StorageError whose message says so.
function isMissing(error: { message?: string; status?: number; statusCode?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.status === 404 || error.statusCode === '404' || /not.?found|does not exist/i.test(error.message ?? '');
}
