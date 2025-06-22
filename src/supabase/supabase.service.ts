import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private IDENTITY_BUCKET = 'identity-bucket';

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  async uploadIdentityDoc(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const filePath = `${userId}/${file.originalname}`;

    const { data, error } = await this.supabase.storage
      .from(this.IDENTITY_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        duplex: 'half',
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
    const { data: urlData } = this.supabase.storage
      .from(this.IDENTITY_BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }
}
