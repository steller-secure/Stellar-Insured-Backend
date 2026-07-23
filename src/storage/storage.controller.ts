import {
  Controller,
  Post,
  Body,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { PinMetadataDto } from './dto/pin-metadata.dto';
import { OptimizeImageDto } from './dto/optimize-image.dto';
import { VerifyHashDto } from './dto/verify-hash.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { PresignUrlDto } from './dto/presign-url.dto';

@ApiTags('Storage')
@ApiBearerAuth()
@SkipThrottle({ auth: true })
@Controller({ path: 'storage', version: '1' })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 metadata pins per hour
  @Post('metadata')
  @ApiOperation({ summary: 'Pin project metadata to storage' })
  @ApiBody({ type: PinMetadataDto })
  @ApiCreatedResponse({ description: 'Returns the new metadata CID' })
  async pinProjectMetadata(@Body() dto: PinMetadataDto): Promise<string> {
    return this.storageService.pinProjectMetadata(dto.metadata);
  }

  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 banner uploads per hour
  @Post('banner')
  @ApiOperation({ summary: 'Optimize and upload a banner image' })
  @ApiBody({ type: OptimizeImageDto })
  @ApiCreatedResponse({ description: 'Returns the uploaded banner CID' })
  async optimizeAndUploadBanner(
    @Body() dto: OptimizeImageDto,
  ): Promise<string> {
    const optimizedImage = await this.storageService.optimizeImage(
      dto.imagePath,
      dto.width,
      dto.height,
    );
    const cid = await this.storageService.pinProjectMetadata({
      image: optimizedImage.toString('base64'),
    });
    return cid;
  }

  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 hash verifications per minute
  @Post('verify-hash')
  @ApiOperation({
    summary: 'Verify an IPFS hash using standardized validation',
  })
  @ApiBody({ type: VerifyHashDto })
  @ApiOkResponse({ description: 'Returns whether the hash is valid' })
  async verifyIPFSHash(@Body() dto: VerifyHashDto): Promise<boolean> {
    return this.storageService.verifyIPFSHash(dto.hash);
  }

  // ──────────────────── S3 endpoints ────────────────────

  @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30 uploads per hour
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        prefix: {
          type: 'string',
          description: 'Optional folder prefix',
          example: 'uploads',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ description: 'Returns the S3 key and public URL' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('prefix') prefix?: string,
  ): Promise<{ key: string; url: string }> {
    return this.storageService.uploadFile(file, prefix);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 presign requests per minute
  @Post('presign')
  @ApiOperation({ summary: 'Generate a presigned GET URL for an S3 object' })
  @ApiBody({ type: PresignUrlDto })
  @ApiOkResponse({ description: 'Returns the presigned URL' })
  async getPresignedUrl(@Body() dto: PresignUrlDto): Promise<{ url: string }> {
    const url = await this.storageService.getPresignedUrl(
      dto.key,
      dto.expiresIn,
    );
    return { url };
  }

  @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 deletes per hour
  @Delete(':key')
  @ApiOperation({ summary: 'Delete an object from S3' })
  @ApiParam({ name: 'key', description: 'S3 object key' })
  @ApiOkResponse({ description: 'Object deleted successfully' })
  async deleteObject(@Param('key') key: string): Promise<{ deleted: boolean }> {
    await this.storageService.deleteObject(key);
    return { deleted: true };
  }
}
