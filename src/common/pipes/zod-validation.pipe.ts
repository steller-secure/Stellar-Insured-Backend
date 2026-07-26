import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { ValidationFieldError } from '../dto/error-response.dto';

/**
 * ZodValidationPipe
 *
 * A NestJS pipe that uses a Zod schema to validate incoming request data.
 * On validation failure it throws a BadRequestException with structured
 * per-field error details, matching the existing ErrorResponseDto contract.
 *
 * Usage:
 *   @UsePipes(new ZodValidationPipe(mySchema))
 *   or
 *   @Body(new ZodValidationPipe(mySchema)) body: MyType
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    // Convert Zod errors into the same ValidationFieldError format
    // that the global exception filter expects from class-validator.
    const fieldErrors: ValidationFieldError[] = this.parseZodErrors(result.error);

    throw new BadRequestException({
      message: fieldErrors.map((fe) => `${fe.field}: ${fe.constraints.join(', ')}`),
      // The global AllExceptionsFilter will catch this and extract
      // the validation details from the message array.
    });
  }

  private parseZodErrors(error: ZodError): ValidationFieldError[] {
    const fieldMap = new Map<string, string[]>();

    for (const issue of error.issues) {
      // Zod paths are arrays like ['addresses', 0, 'street']
      // We join them with dots for a human-readable field path.
      const field = issue.path.length > 0 ? issue.path.join('.') : 'unknown';
      const message = issue.message;

      if (!fieldMap.has(field)) {
        fieldMap.set(field, []);
      }
      fieldMap.get(field)!.push(message);
    }

    return Array.from(fieldMap.entries()).map(([field, constraints]) => ({
      field,
      constraints,
    }));
  }
}