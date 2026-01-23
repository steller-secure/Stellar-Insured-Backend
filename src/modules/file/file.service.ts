import { Injectable } from '@nestjs/common';
import { UploadResponseDto } from './dto/upload-response.dto';

@Injectable()
export class FileService {
    /**
     * Process an uploaded file and return metadata.
     * This provides a foundation for future enhancements like validation,
     * cloud storage integration, or file processing.
     */
    processUpload(file: any): UploadResponseDto {
        return {
            filename: file.filename,
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
        };
    }
}
