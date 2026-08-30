import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  ipfs: {
    host: string;
    port: number;
    protocol: string;
  };
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    s3Bucket: string;
  };
  limits: {
    maxFileSize: number;
    presignExpiry: number;
  };
  timeouts: {
    ipfsInit: number;
  };
}

export default registerAs(
  'storage',
  (): StorageConfig => ({
    ipfs: {
      host: process.env.IPFS_HOST || 'localhost',
      port: parseInt(process.env.IPFS_PORT || '5001', 10),
      protocol: process.env.IPFS_PROTOCOL || 'http',
    },
    aws: {
      region: process.env.AWS_REGION || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      s3Bucket: process.env.AWS_S3_BUCKET || '',
    },
    limits: {
      maxFileSize: parseInt(process.env.S3_MAX_FILE_SIZE || '10485760', 10), // Default 10MB
      presignExpiry: parseInt(process.env.S3_PRESIGN_EXPIRY || '3600', 10), // Default 1 hour
    },
    timeouts: {
      ipfsInit: parseInt(process.env.IPFS_INIT_TIMEOUT_MS || '5000', 10), // Default 5 seconds
    },
  }),
);
