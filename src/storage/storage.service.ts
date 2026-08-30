import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';

// Use a local alias because `ipfs-http-client` is an ESM-only package.
type IPFSHTTPClient = {
  add: (content: string) => Promise<{ path: string }>;
  cat: (hash: string) => AsyncIterable<unknown>;
};

import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  PutObjectCommandOutput,
  DeleteObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  QUEUE_NAMES,
  IpfsPinJobData,
} from '../config/bull.config';
import {
  createCircuitBreaker,
  CircuitBreaker,
} from '../common/resilience/circuit-breaker';
import { withResilience } from '../common/resilience/resilience';
import {
  AWS_S3_POLICY,
  IPFS_POLICY,
  BULL_QUEUE_POLICY,
} from '../common/resilience/resilience.constants';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
]);



let sharp: typeof import('sharp') | undefined;
try {
  sharp = require('sharp');
} catch (err) {
  // sharp native dependency not available
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private ipfs?: IPFSHTTPClient;
  private ipfsPromise?: Promise<IPFSHTTPClient>;
  private ipfsConfig: { host: string; port: number; protocol: string } | null =
    null;
  private readonly ipfsInitTimeoutMs: number;
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly maxFileSize: number;
  private readonly presignExpiry: number;

  /** Circuit breaker + retry for every AWS S3 operation. */
  private readonly s3Breaker: CircuitBreaker = createCircuitBreaker(
    AWS_S3_POLICY.circuitBreaker.name,
    AWS_S3_POLICY.circuitBreaker,
  );

  /** Circuit breaker + retry for IPFS pin/read operations. */
  private readonly ipfsBreaker: CircuitBreaker = createCircuitBreaker(
    IPFS_POLICY.circuitBreaker.name,
    IPFS_POLICY.circuitBreaker,
  );

  /** Circuit breaker for Redis-backed Bull queue enqueues. */
  private readonly queueBreaker: CircuitBreaker = createCircuitBreaker(
    BULL_QUEUE_POLICY.circuitBreaker.name,
    BULL_QUEUE_POLICY.circuitBreaker,
  );

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.IPFS_PIN)
    private readonly ipfsPinQueue: Queue<IpfsPinJobData>,
  ) {
    const ipfsHost =
      this.config.get<string>('storage.ipfs.host') || 'localhost';
    const ipfsPort = this.config.get<number>('storage.ipfs.port') || 5001;
    const ipfsProtocol =
      this.config.get<string>('storage.ipfs.protocol') || 'http';
    this.ipfsConfig = {
      host: ipfsHost,
      port: ipfsPort,
      protocol: ipfsProtocol,
    };

    const region = this.config.get<string>('AWS_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') || '';
    this.maxFileSize = this.config.get<number>('storage.limits.maxFileSize') || 10485760;
    this.presignExpiry = this.config.get<number>('storage.limits.presignExpiry') || 3600;
    this.ipfsInitTimeoutMs = this.config.get<number>('storage.timeouts.ipfsInit') || 5000;

    if (!region || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.error(
        'Missing AWS S3 configuration. Required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET',
      );
      throw new Error(
        'AWS S3 configuration is incomplete. Ensure AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET are set in your environment.',
      );
    }

    this.s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.logger.log(
      `S3 client initialised for bucket "${this.bucket}" in region "${region}"`,
    );
  }

  private async getIpfs(): Promise<IPFSHTTPClient> {
    if (this.ipfs) return this.ipfs;
    if (!this.ipfsConfig) {
      throw new Error('IPFS configuration not initialised');
    }
    if (!this.ipfsPromise) {
      const initPromise = import('ipfs-http-client')
        .then(
          mod =>
            mod.create({
              host: this.ipfsConfig.host,
              port: this.ipfsConfig.port,
              protocol: this.ipfsConfig.protocol,
            }) as unknown as IPFSHTTPClient,
        )
        .catch(err => {
          this.logger.error('Failed to load ipfs-http-client', err);
          throw err;
        });

      const timeoutPromise = new Promise<IPFSHTTPClient>((_, reject) => {
        setTimeout(
          () => reject(new Error('IPFS client initialization timed out')),
          this.ipfsInitTimeoutMs,
        );
      });

      this.ipfsPromise = Promise.race([initPromise, timeoutPromise]);
    }
    this.ipfs = await this.ipfsPromise;
    return this.ipfs;
  }

  // ──────────────────── S3 helpers ────────────────────

  async uploadFile(
    file: Express.Multer.File,
    prefix?: string,
  ): Promise<{ key: string; url: string }> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `MIME type "${file.mimetype}" is not allowed. Accepted: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size ${file.size} exceeds the maximum of ${this.maxFileSize} bytes.`,
      );
    }

    const sanitisedOriginal = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    );
    const timestamp = Date.now();
    const key = prefix
      ? `${prefix.replace(/\/+$/, '')}/${timestamp}-${sanitisedOriginal}`
      : `${timestamp}-${sanitisedOriginal}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      });
      const result: PutObjectCommandOutput = await withResilience(
        this.s3Breaker,
        () => this.s3.send(command),
        { retry: AWS_S3_POLICY.retry },
      );
      this.logger.log(
        `Uploaded file to s3://${this.bucket}/${key} (ETag: ${result.ETag})`,
      );

      const url = `https://${this.bucket}.s3.${this.config.get<string>('AWS_REGION')}.amazonaws.com/${key}`;
      return { key, url };
    } catch (error) {
      this.logger.error(`S3 upload failed for key "${key}"`, error);
      throw new InternalServerErrorException('Failed to upload file to S3');
    }
  }

  async getPresignedUrl(
    key: string,
    expiresIn?: number,
  ): Promise<string> {
    const expiry = expiresIn ?? this.presignExpiry;
    try {
      const command = new PutObjectCommand({ Bucket: this.bucket, Key: key });
      const url = await withResilience(
        this.s3Breaker,
        () => getSignedUrl(this.s3, command, { expiresIn: expiry }),
        { retry: AWS_S3_POLICY.retry },
      );
      this.logger.log(
        `Generated presigned URL for key "${key}" (expires in ${expiry}s)`,
      );
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for key "${key}"`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to generate presigned URL',
      );
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await withResilience(this.s3Breaker, () => this.s3.send(command), {
        retry: AWS_S3_POLICY.retry,
      });
      this.logger.log(`Deleted object s3://${this.bucket}/${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete object "${key}"`, error);
      throw new InternalServerErrorException('Failed to delete object from S3');
    }
  }

  /**
   * Enqueue an IPFS pin job so the (potentially slow) IPFS call happens
   * off-request. Returns immediately after enqueueing.
   */
  async queuePinProjectMetadata(
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await withResilience(
      this.queueBreaker,
      () =>
        this.ipfsPinQueue.add(
          { metadata },
          {
            attempts: 5,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        ),
      { retry: BULL_QUEUE_POLICY.retry },
    );
    this.logger.log('Queued IPFS pin job for project metadata');
  }

  async pinProjectMetadata(metadata: Record<string, unknown>): Promise<string> {
    try {
      const ipfs = await this.getIpfs();
      const cid = await withResilience(
        this.ipfsBreaker,
        () => ipfs.add(JSON.stringify(metadata)),
        { retry: IPFS_POLICY.retry },
      );
      this.logger.log(`Pinned metadata with CID: ${cid.path}`);
      return cid.path;
    } catch (error) {
      this.logger.error('Failed to pin metadata to IPFS', error);
      throw new ServiceUnavailableException('Failed to pin metadata to IPFS');
    }
  }

  async optimizeImage(
    imagePath: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    if (!sharp) {
      this.logger.error(
        'Sharp library is not available. Native dependencies may be missing.',
      );
      throw new ServiceUnavailableException(
        'Image optimization service is unavailable. Native dependencies are missing.',
      );
    }

    const resolvedPath = path.resolve(imagePath);
    if (!fs.existsSync(resolvedPath)) {
      this.logger.warn(`Image path does not exist: ${resolvedPath}`);
      throw new BadRequestException(`Image path does not exist: ${imagePath}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new BadRequestException(`Path is not a file: ${imagePath}`);
    }

    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.gif',
      '.bmp',
      '.tiff',
    ];
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException(
        `Invalid image format: ${ext}. Allowed: ${allowedExtensions.join(', ')}`,
      );
    }

    try {
      const optimizedImage = await sharp(resolvedPath)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer();
      this.logger.log(`Optimized image: ${resolvedPath} -> ${width}x${height}`);
      return optimizedImage;
    } catch (error) {
      this.logger.error(`Failed to optimize image: ${resolvedPath}`, error);
      throw new BadRequestException(
        'Failed to optimize image. Ensure the file is a valid image.',
      );
    }
  }

  async verifyIPFSHash(hash: string): Promise<boolean> {
    try {
      const ipfs = await this.getIpfs();
      return withResilience(
        this.ipfsBreaker,
        async () => {
          const chunks: unknown[] = [];
          for await (const chunk of ipfs.cat(hash)) {
            chunks.push(chunk);
          }
          return chunks.length > 0;
        },
        { retry: IPFS_POLICY.retry },
      );
    } catch (error) {
      this.logger.warn(`IPFS hash verification failed for ${hash}`, error);
      return false;
    }
  }
}
