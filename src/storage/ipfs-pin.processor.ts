import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { StorageService } from './storage.service';
import {
  IpfsPinJobData,
  QUEUE_NAMES,
} from 'src/notification/constants/queue.constants';

@Injectable()
@Processor(QUEUE_NAMES.IPFS_PIN)
export class IpfsPinProcessor {
  private readonly logger = new Logger(IpfsPinProcessor.name);

  constructor(private readonly storageService: StorageService) {}

  @Process()
  async handlePinJob(job: Job<IpfsPinJobData>): Promise<void> {
    const { metadata } = job.data;
    try {
      const cid = await this.storageService.pinProjectMetadata(metadata);
      this.logger.log(`Pinned metadata with CID: ${cid}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to pin metadata to IPFS: ${message}`);
      throw error;
    }
  }
}
