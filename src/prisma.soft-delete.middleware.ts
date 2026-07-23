import { Prisma } from '@prisma/client';

/**
 * Models that support soft delete (have deletedAt field)
 */
export const SOFT_DELETE_MODELS = [
  'User',
  'Project',
  'Contribution',
  'Milestone',
  'ReputationHistory',
  'Category',
  'InsurancePool',
  'ReinsuranceContract',
  'InsurancePolicy',
  'Claim',
  'AuditLog',
  'LedgerCursor',
  'ProcessedEvent',
  'QuarantinedEvent',
  'IndexerLog',
  'NotificationSetting',
  'Notification',
  'EmailOutbox',
  'IdempotencyKey',
] as const;

export type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

/**
 * Configuration for soft delete behavior
 */
export interface SoftDeleteConfig {
  /**
   * Whether to exclude soft-deleted records by default
   * Can be overridden per query with includeDeleted flag
   */
  excludeDeleted?: boolean;
}

type MiddlewareNext = (params: Prisma.MiddlewareParams) => Promise<unknown>;

type SoftDeleteWhere = Record<string, unknown> & {
  _includeDeleted?: boolean;
  _hardDelete?: boolean;
};

interface SoftDeleteMiddlewareArgs {
  where?: SoftDeleteWhere;
  includeDeleted?: boolean;
  hardDelete?: boolean;
  data?: Record<string, unknown>;
}

/**
 * Query extension to include soft-deleted records
 * Usage: await prisma.user.findMany({ includeDeleted: true })
 */
declare global {
  namespace PrismaJson {}
}

/**
 * Create soft delete middleware for Prisma
 * This middleware automatically filters out soft-deleted records
 * and prevents hard deletes unless explicitly allowed
 */
export function createSoftDeleteMiddleware(
  config: SoftDeleteConfig = { excludeDeleted: true },
) {
  return async (params: Prisma.MiddlewareParams, next: MiddlewareNext) => {
    const { model, action } = params;
    const args = getMiddlewareArgs(params);

    // Only apply to models that support soft delete
    if (!SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)) {
      return next(params);
    }

    // Handle find operations - add where clause for soft delete
    if (
      ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findMany'].includes(
        action,
      )
    ) {
      const includeDeleted = shouldIncludeDeleted(args);

      if (config.excludeDeleted && !includeDeleted) {
        args.where = {
          ...args.where,
          deletedAt: null,
        };
      }

      removeIncludeDeletedFlags(args);
    }

    // Handle update operations - prevent updating through relations
    if (action === 'update' || action === 'updateMany') {
      const isRestore = args.data?.deletedAt === null;

      if (config.excludeDeleted && !isRestore) {
        args.where = {
          ...args.where,
          deletedAt: null,
        };
      }
    }

    // Handle delete operations - convert to soft delete
    if (action === 'delete' || action === 'deleteMany') {
      if (shouldHardDelete(args)) {
        removeHardDeleteFlags(args);
        return next(params);
      }

      removeHardDeleteFlags(args);

      const updateArgs = {
        where: {
          ...args.where,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      };

      return next({
        ...params,
        action: action === 'delete' ? 'update' : 'updateMany',
        args: updateArgs,
      });
    }

    // Handle count operations - exclude soft-deleted records
    if (action === 'count') {
      const includeDeleted = shouldIncludeDeleted(args);

      if (config.excludeDeleted && !includeDeleted) {
        args.where = {
          ...args.where,
          deletedAt: null,
        };
      }

      removeIncludeDeletedFlags(args);
    }

    // Handle aggregate operations - exclude soft-deleted records
    if (action === 'aggregate') {
      const includeDeleted = shouldIncludeDeleted(args);

      if (config.excludeDeleted && !includeDeleted) {
        args.where = {
          ...args.where,
          deletedAt: null,
        };
      }

      removeIncludeDeletedFlags(args);
    }

    return next(params);
  };
}

function getMiddlewareArgs(
  params: Prisma.MiddlewareParams,
): SoftDeleteMiddlewareArgs {
  if (!params.args) {
    params.args = {};
  }

  return params.args as SoftDeleteMiddlewareArgs;
}

function shouldIncludeDeleted(args: SoftDeleteMiddlewareArgs): boolean {
  return args.where?._includeDeleted === true || args.includeDeleted === true;
}

function shouldHardDelete(args: SoftDeleteMiddlewareArgs): boolean {
  return args.where?._hardDelete === true || args.hardDelete === true;
}

function removeHardDeleteFlags(args: SoftDeleteMiddlewareArgs): void {
  if (args.where?._hardDelete !== undefined) {
    delete args.where._hardDelete;
  }
  if (args.hardDelete !== undefined) {
    delete args.hardDelete;
  }
}

function removeIncludeDeletedFlags(args: SoftDeleteMiddlewareArgs): void {
  if (args.where?._includeDeleted !== undefined) {
    delete args.where._includeDeleted;
  }
  if (args.includeDeleted !== undefined) {
    delete args.includeDeleted;
  }
}
