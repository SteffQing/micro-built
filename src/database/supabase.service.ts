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
    const filePath = `${year}/${month.toUpperCase()}`;

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

  async uploadVariationScheduleDoc(file: Buffer, period: string) {
    const [month, year] = period.split(' ');
    const filePath = `${year}/${month.toUpperCase()}`;
    await this.supabase.storage
      .from(this.VARIATION_BUCKET)
      .upload(filePath, file, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        duplex: 'half',
      });
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
