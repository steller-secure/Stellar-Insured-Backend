export enum Permission {
  // Claims
  CLAIM_APPROVE = 'claim:approve',
  CLAIM_REJECT = 'claim:reject',

  // DAO
  DAO_PROPOSAL_CREATE = 'dao:proposal:create',
  DAO_PROPOSAL_FINALIZE = 'dao:proposal:finalize',

  // Risk Pool
  RISK_POOL_MANAGE = 'risk_pool:manage',

  // Admin
  USER_MANAGE = 'user:manage',
}
