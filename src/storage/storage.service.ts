import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { create } from 'ipfs-http-client';

import sharp from 'sharp';

@Injectable()
export class StorageService {
  private ipfs: ReturnType<typeof create>;

  constructor(private readonly config: ConfigService) {
    const ipfsHost = this.config.get<string>('IPFS_HOST') || 'localhost';
    const ipfsPort = this.config.get<number>('IPFS_PORT') || 5001;
    const ipfsProtocol = this.config.get<string>('IPFS_PROTOCOL') || 'http';
    
    this.ipfs = create({
      host: ipfsHost,
      port: ipfsPort,
      protocol: ipfsProtocol,
    });
  }

  async pinFile(fileBuffer: Buffer): Promise<string> {
    const cid = await this.ipfs.add(fileBuffer);
    return cid.path;
  }

  async pinProjectMetadata(metadata: any): Promise<string> {
    const data = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
    const cid = await this.ipfs.add(data);
    return cid.path;
  }

  async optimizeImage(fileBuffer: Buffer, width: number, height: number): Promise<Buffer> {
    const optimizedImage = await sharp(fileBuffer)
      .resize(width, height)
      .jpeg({ quality: 80 })
      .toBuffer();
    return optimizedImage;
  }

  async verifyIPFSHash(hash: string): Promise<boolean> {
    try {
      await this.ipfs.cat(hash);
      return true;
    } catch (error) {
      return false;
    }
  }
}
