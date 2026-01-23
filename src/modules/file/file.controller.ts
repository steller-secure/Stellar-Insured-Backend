import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiConsumes,
    ApiBody,
} from '@nestjs/swagger';
import { FileService } from './file.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('Files')
@Controller('files')
export class FileController {
    constructor(private readonly fileService: FileService) { }

    @Post('upload')
    @ApiOperation({ summary: 'Upload a single file' })
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
            },
            required: ['file'],
        },
    })
    @ApiResponse({
        status: 201,
        description: 'File uploaded successfully',
        type: UploadResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'No file provided or invalid file',
    })
    @UseInterceptors(FileInterceptor('file'))
    upload(@UploadedFile() file: any): UploadResponseDto {
        if (!file) {
            throw new BadRequestException('No file provided');
        }
        return this.fileService.processUpload(file);
    }
}
