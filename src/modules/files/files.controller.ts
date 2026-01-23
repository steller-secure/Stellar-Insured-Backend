import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UPLOAD_CONFIG } from '../../common/config/file-upload.config';
import { CustomUploadTypeValidator } from './file-type.validator';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  
  @Post('upload')
  @ApiOperation({ summary: 'Upload a generic file (Image/PDF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
  }))
  uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(
          new CustomUploadTypeValidator({
            fileType: UPLOAD_CONFIG.ALLOWED_FILE_TYPES as any, 
          }),
        )
        .addMaxSizeValidator({
          maxSize: UPLOAD_CONFIG.MAX_FILE_SIZE,
        })
        .build({
          errorHttpStatusCode: UPLOAD_CONFIG.ERROR_HTTP_STATUS as any,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
  ) {
    return {
      message: 'File uploaded successfully',
      originalName: file.originalname,
      savedName: file.filename,
      path: file.path,
    };
  }
}