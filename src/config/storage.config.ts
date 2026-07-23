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
  }),
);
