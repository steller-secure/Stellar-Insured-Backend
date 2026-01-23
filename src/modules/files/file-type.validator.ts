import { FileValidator } from '@nestjs/common';

export interface CustomUploadTypeValidatorOptions {
  fileType: string[];
}

export class CustomUploadTypeValidator extends FileValidator<CustomUploadTypeValidatorOptions> {
  buildErrorMessage(): string {
    return `Upload not allowed. Allowed types: ${this.validationOptions.fileType.join(', ')}`;
  }

  isValid(file: any): boolean {
    if (!this.validationOptions) {
      return true;
    }
    return this.validationOptions.fileType.includes(file.mimetype);
  }
}