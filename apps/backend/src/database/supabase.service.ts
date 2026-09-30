import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private IDENTITY_BUCKET = 'identity-bucket';
  private REPAYMENTS_BUCKET = 'repayments';
  private VARIATION_BUCKET = 'variation';
  private AVATAR_BUCKET = 'user-avatar';

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  // Private buckets already checked this process (D10: files other than avatars are private).
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
    try {
      const { data, error } = await this.supabase.storage.listBuckets();
      if (error) throw error;

      return { status: 'alive', bucketCount: data.length };
    } catch (error) {
      throw error;
    }
  }

  private generateFilename(name: string) {
    const now = new Date();

    const pad = (n: number) => n.toString().padStart(2, '0');

    const dateString = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const filename = `${dateString}_${name}`;
    return filename;
  }

  // async uploadOnboardingForm(file: Express.Multer.File) {
  //   const filePath = this.generateFilename(file.originalname);

  //   const { data, error } = await this.supabase.storage
  //     .from(this.IDENTITY_BUCKET)
  //     .upload(filePath, file.buffer, {
  //       contentType: file.mimetype,
  //       duplex: 'half',
  //     });

  //   if (error) {
  //     throw new Error(`Upload failed: ${error.message}`);
  //   }
  //   const { data: urlData } = this.supabase.storage
  //     .from(this.IDENTITY_BUCKET)
  //     .getPublicUrl(data.path);

  //   return urlData.publicUrl;
  // }

  async uploadUserAvatar(file: Express.Multer.File, userId: string) {
    // only images acccepted -> inform FE

    const { data, error } = await this.supabase.storage
      .from(this.AVATAR_BUCKET)
      .upload(userId, file.buffer, {
        contentType: file.mimetype,
        duplex: 'half',
        upsert: true,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
    const { data: urlData } = this.supabase.storage
      .from(this.AVATAR_BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  async uploadRepaymentsDoc(file: Express.Multer.File, period: string) {
    const [month, year] = period.split(' ');
    const filePath = `${year}/${month.toUpperCase()}-${Date.now()}`;

    const { error, data } = await this.supabase.storage
      .from(this.REPAYMENTS_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        duplex: 'half',
      });
    if (error) {
      return { error: `Upload failed: ${error.message}` };
    }

    const { data: urlData } = this.supabase.storage
      .from(this.REPAYMENTS_BUCKET)
      .getPublicUrl(data.path);

    return { data: urlData.publicUrl };
  }

  async uploadVariationScheduleDoc(
    file: Buffer,
    period: string,
    scheduleId: string,
    status: string,
  ) {
    const [month, year] = period.split(' ');
    const filePath = `${year}/${month.toUpperCase()}/${scheduleId}-${status.toLowerCase()}.xlsx`;
    const { data, error } = await this.supabase.storage
      .from(this.VARIATION_BUCKET)
      .upload(filePath, file, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        duplex: 'half',
        upsert: false,
      });
    if (error) {
      // A worker can crash after storage accepted the upload but before the
      // database recorded its hash. Reuse only an identical existing artifact.
      const existing = await this.supabase.storage
        .from(this.VARIATION_BUCKET)
        .download(filePath);
      if (
        existing.data &&
        Buffer.from(await existing.data.arrayBuffer()).equals(file)
      )
        return filePath;
      throw new Error(`Variation artifact upload failed: ${error.message}`);
    }
    return data.path;
  }

  async getVariationSchedule(period: string) {
    const [month, year] = period.split(' ');
    const filePath = `${year}/${month.toUpperCase()}`;

    const { data } = await this.supabase.storage
      .from(this.VARIATION_BUCKET)
      .download(filePath);

    if (!data) return null;

    const arrayBuffer = await data.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    return fileBuffer;
  }
}
