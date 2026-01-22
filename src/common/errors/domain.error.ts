export abstract class DomainError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entity: string, identifier: string) {
    super(`${entity} con ID ${identifier} no fue encontrado`, 'ENTITY_NOT_FOUND');
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_FAILED', details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'No autorizado para realizar esta acción') {
    super(message, 'UNAUTHORIZED_ACCESS');
  }
}