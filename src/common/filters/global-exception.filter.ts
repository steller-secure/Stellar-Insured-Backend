import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../errors/domain.error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let code = 'INTERNAL_SERVER_ERROR';
    let details = null;

    // 1. Mapeo de nuestros errores de Dominio
    if (exception instanceof DomainError) {
      message = exception.message;
      code = exception.code;
      details = exception.details;

      if (code === 'ENTITY_NOT_FOUND') status = HttpStatus.NOT_FOUND;
      if (code === 'VALIDATION_FAILED') status = HttpStatus.BAD_REQUEST;
      if (code === 'UNAUTHORIZED_ACCESS') status = HttpStatus.UNAUTHORIZED;
    } 
    // 2. Errores nativos de NestJS (Ej: validaciones automáticas de DTOs)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = res.message || res;
      code = 'HTTP_EXCEPTION';
    }

    // Registro para el desarrollador (Observabilidad)
    this.logger.error(`[${code}] ${request.method} ${request.url}`, exception.stack);

    // Respuesta estandarizada para el cliente
    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}