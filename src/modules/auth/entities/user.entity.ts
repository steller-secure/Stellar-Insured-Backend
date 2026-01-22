import { v4 as uuid } from 'uuid';

/**
 * User role enumeration
 */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  DAO_MEMBER = 'DAO_MEMBER',
}

/**
 * Signup source enumeration - tracks where the user came from
 */
export enum SignupSource {
  ORGANIC = 'ORGANIC',
  REFERRAL = 'REFERRAL',
  MARKETING_CAMPAIGN = 'MARKETING_CAMPAIGN',
  BULK_IMPORT = 'BULK_IMPORT',
  API = 'API',
  PARTNERSHIP = 'PARTNERSHIP',
}

/**
 * User account status
 */
export enum UserStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

/**
 * User entity - represents a user account in the system
 */
export class User {
  /**
   * Unique user identifier (UUID v4)
   */
  id: string = uuid();

  /**
   * Stellar public key (wallet address) - primary identifier
   * Format: ^G[A-Z2-7]{55}$ (Stellar public key format)
   */
  walletAddress: string;

  /**
   * Optional email address for notifications and recovery
   */
  email?: string;

  /**
   * User's display name or profile name
   */
  displayName?: string;

  /**
   * User role in the system
   * @default UserRole.USER
   */
  role: UserRole = UserRole.USER;

  /**
   * User account status
   * @default UserStatus.ACTIVE
   */
  status: UserStatus = UserStatus.ACTIVE;

  /**
   * Email verification status
   */
  isEmailVerified: boolean = false;

  /**
   * Wallet verification status
   */
  isWalletVerified: boolean = false;

  /**
   * Source of signup
   */
  signupSource: SignupSource = SignupSource.ORGANIC;

  /**
   * Referral code used during signup (if applicable)
   */
  referralCode?: string;

  /**
   * Referral ID - user who referred this user
   */
  referrerId?: string;

  /**
   * KYC verification status
   */
  kycVerified: boolean = false;

  /**
   * Two-factor authentication enabled
   */
  twoFactorEnabled: boolean = false;

  /**
   * Last login timestamp
   */
  lastLoginAt?: Date;

  /**
   * Account creation timestamp
   */
  createdAt: Date = new Date();

  /**
   * Last account update timestamp
   */
  updatedAt: Date = new Date();

  /**
   * Soft delete timestamp
   */
  deletedAt?: Date;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * User preferences entity - stores user configuration and settings
 */
export class UserPreference {
  /**
   * Unique identifier
   */
  id: string = uuid();

  /**
   * Associated user ID
   */
  userId: string;

  /**
   * Email notifications enabled
   * @default true
   */
  emailNotificationsEnabled: boolean = true;

  /**
   * SMS notifications enabled
   */
  smsNotificationsEnabled: boolean = false;

  /**
   * Push notifications enabled
   */
  pushNotificationsEnabled: boolean = true;

  /**
   * Receive promotional emails
   * @default true
   */
  receivePromotionalEmails: boolean = true;

  /**
   * Preferred language/locale
   * @default 'en'
   */
  preferredLocale: string = 'en';

  /**
   * Timezone for the user
   */
  timezone?: string;

  /**
   * Created timestamp
   */
  createdAt: Date = new Date();

  /**
   * Updated timestamp
   */
  updatedAt: Date = new Date();
}

/**
 * User portfolio entity - tracks user's insurance policies and holdings
 */
export class UserPortfolio {
  /**
   * Unique identifier
   */
  id: string = uuid();

  /**
   * Associated user ID
   */
  userId: string;

  /**
   * Total active policies
   */
  activePoliciesCount: number = 0;

  /**
   * Total claims submitted
   */
  totalClaimsSubmitted: number = 0;

  /**
   * Total claims approved
   */
  totalClaimsApproved: number = 0;

  /**
   * Total invested amount (in smallest unit)
   */
  totalInvestedAmount: string = '0';

  /**
   * Total returns received
   */
  totalReturns: string = '0';

  /**
   * Portfolio creation timestamp
   */
  createdAt: Date = new Date();

  /**
   * Portfolio update timestamp
   */
  updatedAt: Date = new Date();
}

/**
 * Onboarding checklist entity - tracks user onboarding progress
 */
export class UserOnboardingChecklist {
  /**
   * Unique identifier
   */
  id: string = uuid();

  /**
   * Associated user ID
   */
  userId: string;

  /**
   * Email verified
   */
  emailVerified: boolean = false;

  /**
   * Wallet verified
   */
  walletVerified: boolean = false;

  /**
   * Profile completed
   */
  profileCompleted: boolean = false;

  /**
   * KYC started
   */
  kycStarted: boolean = false;

  /**
   * KYC completed
   */
  kycCompleted: boolean = false;

  /**
   * Payment method added
   */
  paymentMethodAdded: boolean = false;

  /**
   * First policy purchased
   */
  firstPolicyPurchased: boolean = false;

  /**
   * Profile picture uploaded
   */
  profilePictureUploaded: boolean = false;

  /**
   * Two-factor authentication enabled
   */
  twoFactorEnabled: boolean = false;

  /**
   * Terms and conditions accepted
   */
  termsAccepted: boolean = false;

  /**
   * Overall completion percentage
   */
  completionPercentage: number = 0;

  /**
   * Checklist created timestamp
   */
  createdAt: Date = new Date();

  /**
   * Checklist updated timestamp
   */
  updatedAt: Date = new Date();
}
