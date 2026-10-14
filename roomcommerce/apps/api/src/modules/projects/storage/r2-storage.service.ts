import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../../config/env.js';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async createPresignedUploadUrl(
    projectId: string,
    fileExtension = 'jpg',
  ): Promise<{ uploadUrl: string; key: string }> {
    const key = `raw-uploads/${projectId}.${fileExtension}`;
    const command = new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      ContentType: `image/${fileExtension === 'heic' ? 'heic' : 'jpeg'}`,
    });

    // 5-minute expiry URL (FR-101, SEC-03)
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    return { uploadUrl, key };
  }

  async deleteArtifact(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: key,
        }),
      );
      this.logger.log(`Deleted R2 artifact: ${key}`);
    } catch (err: any) {
      this.logger.error(`Failed to delete R2 artifact ${key}: ${err.message}`);
      throw err;
    }
  }

  getPublicUrl(key: string): string {
    return `${env.CLOUDFLARE_R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${key}`;
  }
}
